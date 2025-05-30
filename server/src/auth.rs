
mod internal;
mod oidc;

use std::option::Option;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use anyhow::{bail, Error};
use async_trait::async_trait;
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use uuid::Uuid;
use chrono::{Utc, DateTime};
use jsonwebtoken::{encode, Header, EncodingKey, DecodingKey, Validation, decode};
use crate::auth::internal::{hash_password, AuthProviderInternal};
use crate::auth::oidc::AuthProviderOIDC;
use crate::server_config::{AuthConfig, AuthProviderType};
use sha3::Sha3_256;
use hmac::{Hmac, Mac};
use reqwest::Url;
use tracing::{debug, info, warn};

#[derive(Clone, Serialize, Deserialize)]
pub struct User {
    pub user_id: Uuid,
    pub name: Option<String>,
    pub email: String,
}

#[derive(Clone)]
pub struct AuthService {
    config: AuthConfig,
    pool: PgPool,
    providers: HashMap<String, Arc<dyn AuthProviderImpl>>
}

impl AuthService {
    pub async fn new(config: AuthConfig, pool: PgPool, public_url: Url) -> Self {
        let mut providers = HashMap::new();
        for (id, provider) in &config.providers {
            if !provider.enabled {
                continue;
            }

            let provider: Arc<dyn AuthProviderImpl> = match &provider.auth_type {
                AuthProviderType::Internal {} => {
                    Arc::new(AuthProviderInternal::new(id.clone(), pool.clone()))
                },
                AuthProviderType::OIDC {
                    issuer_url,
                    client_id,
                    client_secret,
                    scopes,
                    name_claim,
                    email_claim,
                } => {
                    let callback_url = public_url.join(&format!("/auth/{}/callback", id)).unwrap();
                    Arc::new(AuthProviderOIDC::new(
                        id.clone(), pool.clone(),
                        issuer_url.clone(), client_id.clone(), client_secret.clone(), scopes.clone(),
                        callback_url,
                        name_claim.clone(), email_claim.clone(),
                    ).await.unwrap())
                }
                _ => todo!()
            };

            providers.insert(id.clone(), provider);
        }


        Self { config, pool, providers }
    }

    pub fn get_providers(&self) -> Vec<Value> {
        let mut primary = None;
        let mut others = Vec::new();

        for (id, provider) in &self.config.providers {
            if !provider.enabled {
                continue;
            }

            let provider_item = json!({
                "id": id.clone(),
                "type": provider.auth_type.as_ref(),
                "primary": provider.primary,
                "name": provider.name.clone().unwrap_or(id.clone()),
            });

            if provider.primary {
                primary = Some(provider_item);
            } else {
                others.push(provider_item);
            }
        }

        let mut result = Vec::new();
        if let Some(p) = primary {
            result.push(p);
        }
        result.extend(others);
        result
    }

    pub async fn authenticate_with(&self, id: &str, payload: HashMap<String, String>) -> Result<AuthResponse, Error> {
        let provider = self.providers.get(id)
            .ok_or_else(|| anyhow::anyhow!("Auth method not found"))?;

        let auto_signup = self.config.auto_signup;
        info!("Auto signup: {}", auto_signup);
        let auth_response = provider.authenticate(&payload, auto_signup).await?;
        
        Ok(auth_response)
    }

    pub async fn add_initial_user(&self) -> Result<(), Error> {
        // Check if user table is empty
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM \"user\"")
            .fetch_one(&self.pool)
            .await?;

        if count.0 > 0 {
            debug!("Users already exist, skipping initial user creation.");
            return Ok(());
        }

        let Some(config) = &self.config.initial_user else {
            warn!("Initial user config is missing, but user table is empty.");
            return Ok(());
        };

        let provider = self.providers.get(&config.provider_id)
            .ok_or_else(|| anyhow::anyhow!("Auth provider '{}' not found", config.provider_id))?;

        let user_id = provider.add_user(
            &config.email,
            config.name.as_deref(),
            config.password.as_deref(),
        ).await?;

        provider.create_link(&config.provider_id, &user_id, None).await?;

        info!("Initial user '{}' created and linked to provider '{}'", config.email, config.provider_id);

        Ok(())
    }

    pub async fn logout_user(&self, user_id: &Uuid) -> Result<(), Error> {
        sqlx::query(
            "UPDATE refresh_token
             SET revoked_at = NOW()
             WHERE user_id = $1 AND revoked_at IS NULL"
        )
            .bind(user_id)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn issue_jwt(&self, user_id: &Uuid, email: &String) -> Result<String, Error> {
        let claims = Claims {
            sub: user_id.to_string(),
            email: email.clone(),
            exp: (Utc::now() + self.config.jwt_expiration).timestamp() as usize,
        };
        let jwt = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_ref())
        )?;
        Ok(jwt)
    }

    pub fn decode_jwt(&self, token: &str) -> Result<Claims, Error> {
        let token_data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(self.config.jwt_secret.as_bytes()),
            &Validation::default(), // you can customize if needed
        )?;
        Ok(token_data.claims)
    }
    
    pub async fn issue_refresh_token(&self, auth_id: &str, user_id: &Uuid) -> Result<(String, DateTime<Utc>), Error> {
        let refresh_token = Uuid::new_v4().to_string();
        let refresh_hash = hash_token(&refresh_token, &self.config.refresh_token_secret)?;
        let expires_at = Utc::now() + self.config.refresh_token_expiration;

        sqlx::query(
            "INSERT INTO refresh_token (user_id, auth_id, token_hash, expires_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, auth_id) DO UPDATE
                     SET token_hash = $3, expires_at = $4, revoked_at = NULL")
            .bind(user_id)
            .bind(auth_id)
            .bind(refresh_hash)
            .bind(expires_at)
            .execute(&self.pool)
            .await?;

        Ok((refresh_token, expires_at))
    }
    pub async fn refresh_access_token(
        &self,
        refresh_token: &str
    ) -> Result<(String, User), Error> {
        let token_hash = hash_token(&refresh_token, &self.config.refresh_token_secret)?;
        
        let row = sqlx::query(
            "SELECT rt.user_id, rt.auth_id, rt.expires_at, rt.revoked_at, u.email, u.name
             FROM refresh_token rt
             JOIN \"user\" u ON rt.user_id = u.user_id
             WHERE rt.token_hash = $1"
        )
            .bind(&token_hash)
            .fetch_optional(&self.pool)
            .await?;

        let row = match row {
            Some(row) => row,
            None => bail!("Invalid refresh token"),
        };

        let expires_at: DateTime<Utc> = row.try_get("expires_at")?;
        let revoked_at: Option<DateTime<Utc>> = row.try_get("revoked_at")?;

        if revoked_at.is_some() || expires_at < Utc::now() {
            bail!("Refresh token expired or revoked");
        }
        
        let user = User {
            user_id: row.try_get("user_id")?,
            name: row.try_get("name")?,
            email: row.try_get("email")?
        };

        let jwt = self.issue_jwt(&user.user_id, &user.email).await?;
        Ok((jwt, user))
    }
}

pub enum AuthResponse {
    Success(User), // user_id, email
    UserNotFound, // No user found
    WrongCredentials,
    Redirect(String), // URL to redirect
}

#[derive(Debug, Deserialize, Serialize)]
pub struct Claims {
    pub sub: String, // user_id
    pub email: String,
    pub exp: usize,
}

#[async_trait]
pub trait AuthProviderImpl: Send + Sync {
    fn get_pool(&self) -> &PgPool;
    async fn authenticate(&self, payload: &HashMap<String, String>, auto_signup: bool) -> Result<AuthResponse, Error>;
    async fn create_link(&self, auth_id: &str, user_id: &Uuid, identifier: Option<&str>) -> Result<(), Error> {
        sqlx::query(
            "INSERT INTO user_auth_link (user_id, auth_id, identifier) VALUES ($1, $2, $3)
                  ON CONFLICT (user_id, auth_id) DO UPDATE SET identifier=$3")
            .bind(&user_id)
            .bind(auth_id)
            .bind(identifier)
            .execute(self.get_pool())
            .await?;
        Ok(())
    }

    async fn add_user(&self, email: &str, name: Option<&str>, password: Option<&str>) -> Result<Uuid, Error> {
        let mut password_hash: Option<String> = None;
        if let Some(password) = password {
            password_hash = Some(hash_password(password)?);
        }
        let user_id  = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO \"user\" (user_id, name, email, password_hash) VALUES ($1, $2, $3, $4)")
            .bind(&user_id)
            .bind(name)
            .bind(email)
            .bind(password_hash)
            .execute(self.get_pool())
            .await?;
        Ok(user_id)
    }
}

fn hash_token(token: &str, secret: &str) -> Result<String, Error> {
    let mut mac: Hmac<Sha3_256> = Hmac::new_from_slice(secret.as_bytes())?;
    mac.update(token.as_bytes());
    let result = mac.finalize();
    Ok(format!("{:x}", result.into_bytes()))
}