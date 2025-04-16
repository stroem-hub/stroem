
mod internal;
mod oidc;

use std::option::Option;
use crate::auth::internal::hash_password;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use anyhow::{bail, Error};
use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;
use chrono::{Utc, Duration};
use jsonwebtoken::{encode, Header, EncodingKey};
use tracing::log::kv::Source;
use crate::auth::internal::AuthProviderInternal;
use crate::auth::oidc::AuthProviderOIDC;
use crate::server_config::{AuthConfig, AuthProviderType};

#[derive(Clone, Serialize, Deserialize)]
pub struct User {
    pub user_id: Uuid,
    pub name: Option<String>,
    pub email: String,
}

#[derive(Deserialize)]
struct SignupPayload {
    email: String,
    password: Option<String>,
}

#[derive(Clone)]
pub struct AuthService {
    config: AuthConfig,
    pool: PgPool,
    providers: HashMap<String, Arc<dyn AuthProviderImpl>>
}

impl AuthService {
    pub fn new(config: AuthConfig, pool: PgPool) -> Self {
        let mut providers = HashMap::new();
        for (id, provider) in &config.providers {
            if !provider.enabled.unwrap_or(true) {
                continue;
            }

            let provider: Arc<dyn AuthProviderImpl> = match provider.auth_type {
                AuthProviderType::Internal {} => {
                    Arc::new(AuthProviderInternal::new(id.clone(), pool.clone()))
                },
                AuthProviderType::OIDC {} => {
                    Arc::new(AuthProviderOIDC::new(id.clone(), pool.clone()))
                }
                _ => todo!()
            };

            providers.insert(id.clone(), provider);
        }


        Self { config, pool, providers }
    }

    pub async fn authenticate_with(&self, id: &str, payload: Option<Value>) -> Result<AuthResponse, Error> {
        let provider = self.providers.get(id)
            .ok_or_else(|| anyhow::anyhow!("Auth method not found"))?;

        let auth_response = provider.authenticate(&payload).await?;

        if let AuthResponse::UserNotFound = auth_response {
            if self.config.auth_signup.unwrap_or(false) {
                let SignupPayload { email, password } = serde_json::from_value(payload.unwrap().clone())?;

                // Add user
                let user_id = self.add_user(&email, None, password.as_deref()).await?;
                let user = User {
                    user_id,
                    name: None,
                    email: email.to_string(),
                };
                provider.create_link(id, &user.user_id, None).await?;
                return Ok(AuthResponse::Success(user));
            }
        }

        Ok(auth_response)
    }


    pub async fn add_user(&self, email: &str, name: Option<&str>, password: Option<&str>) -> Result<(Uuid), Error> {
        let mut password_hash: Option<String> = None;
        if let Some(password) = password {
            password_hash = Some(hash_password(password)?);
        }
        let user_id  = Uuid::new_v4();
        sqlx::query(
            "INSERT INTO user (user_id, name, email, password_hash) VALUES ($1, $2, $3, $4)")
            .bind(&user_id)
            .bind(name)
            .bind(email)
            .bind(password_hash)
            .execute(&self.pool)
            .await?;
        Ok(user_id)
    }

    pub async fn issue_jwt(&self, auth_id: &str, user_id: &Uuid, email: String) -> Result<(String, String), Error> {
        let claims = Claims {
            sub: user_id.to_string(),
            email,
            exp: (Utc::now() + Duration::minutes(15)).timestamp() as usize,
        };
        let jwt = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.config.jwt_secret.as_ref())
        )?;

        let refresh_token = Uuid::new_v4().to_string();
        let refresh_hash = hash_password(&refresh_token)?;
        let expires_at = Utc::now() + Duration::days(30);

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

        Ok((jwt, refresh_token))
    }
}

pub enum AuthResponse {
    Success(User), // user_id, email
    UserNotFound, // No user found
    WrongCredentials,
    Redirect(String), // URL to redirect
}

#[derive(Serialize)]
struct Claims {
    sub: String,
    email: String,
    exp: usize,
}

#[async_trait]
pub trait AuthProviderImpl: Send + Sync {
    fn get_pool(&self) -> &PgPool;
    async fn authenticate(&self, payload: &Option<Value>) -> Result<AuthResponse, Error>;
    // async fn add_user(&self, name: Option<String>, email: String, password: Option<String>) -> Result<Uuid, Error>;
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
}