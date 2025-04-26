use std::collections::HashMap;
use anyhow::Error;
use async_trait::async_trait;
use serde_json::Value;
use sqlx::{PgPool, Row};
use crate::auth::{AuthProviderImpl, AuthResponse, User};
use openid;
use openid::{DiscoveredClient, Options, StandardClaimsSubject, Token};
use openid::error::StandardClaimsSubjectMissing;
use reqwest;
use reqwest::Url;
use serde::{Deserialize, Serialize};
use tracing::info;
use uuid::Uuid;

type OpenIDClient = openid::Client<openid::Discovered, openid::StandardClaims>;
#[derive(Clone)]
pub struct AuthProviderOIDC {
    id: String,
    pool: PgPool,
    client: OpenIDClient,
    scopes: String,
    name_claim: String,
    email_claim: String,
}

#[derive(Debug, Deserialize, Serialize)]
struct CustomUserinfo(std::collections::HashMap<String, serde_json::Value>);

impl CustomUserinfo {
    fn get_claim(&self, claim_name: &str) -> Option<&str> {
        self.0.get(claim_name).map(|v| v.as_str())?
    }
}

impl StandardClaimsSubject for CustomUserinfo {
    fn sub(&self) -> Result<&str, StandardClaimsSubjectMissing> {
        self.0
            .get("sub")
            .and_then(|x| x.as_str())
            .ok_or(StandardClaimsSubjectMissing)
    }
}

impl openid::CompactJson for CustomUserinfo {}

impl AuthProviderOIDC {
    pub async fn new(id: String, pool: PgPool,
                     issuer_url: String,
                     client_id: String,
                     client_secret: Option<String>,
                     scopes: String,
                     callback_url: Url,
                     name_claim: String,
                     email_claim: String,
    ) -> Result<Self, Error> {
        let http_client = reqwest::ClientBuilder::new()
            // Following redirects opens the client up to SSRF vulnerabilities.
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        let issuer = reqwest::Url::parse(&issuer_url)?;
        let client = DiscoveredClient::discover(client_id, client_secret, Some(callback_url.to_string()), issuer).await?;

        Ok(Self { id, pool, client, scopes, name_claim, email_claim })
    }
}

#[async_trait]
impl AuthProviderImpl for AuthProviderOIDC {
    fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    async fn authenticate(&self, payload: &HashMap<String, String>, auto_signup: bool) -> Result<AuthResponse, Error> {
        if let Some(code) = payload.get("code") {
            let mut token: Token = self.client.request_token(code).await?.into();
            if let Some(id_token) = token.id_token.as_mut() {
                self.client.decode_token(id_token)?;
                self.client.validate_token(id_token, None, None)?;
            }
            
            let userinfo: CustomUserinfo = self.client.request_userinfo_custom(&token).await?;
            info!("userinfo: {:?}", userinfo);
            let email = userinfo.get_claim(&self.email_claim).unwrap();
            let name = userinfo.get_claim(&self.name_claim);
            let sub = userinfo.sub()?;
            info!("email: {:?}, name: {:?}, ident: {:?}", email, name, sub);

            let user = sqlx::query("SELECT user_id, name FROM \"user\" WHERE email = $1")
                .bind(&email)
                .fetch_optional(&self.pool)
                .await?;

            return match user {
                Some(u) => {
                    // We need to update name for the user if it changed
                    let old_name = u.get::<Option<&str>, &str>("name").clone();
                    if name != old_name {
                        sqlx::query(
                            "UPDATE \"user\" SET name = $1 WHERE email = $2")
                            .bind(&name)
                            .bind(&email)
                            .execute(self.get_pool())
                            .await?;
                    }

                    let user = User {
                        user_id: u.get::<Uuid, &str>("user_id").clone(),
                        name: name.map(str::to_owned),
                        email: email.to_string()
                    };
                    self.create_link(&self.id, &user.user_id, Some(sub)).await?;
                    Ok(AuthResponse::Success(user))
                }
                None => {
                    if auto_signup {
                        let user_id = self.add_user(&email, name, None).await?;
                        let user = User {
                            user_id,
                            name: name.map(str::to_owned),
                            email: email.to_string(),
                        };
                        self.create_link(&self.id, &user.user_id, Some(sub)).await?;
                        return Ok(AuthResponse::Success(user));
                    }
                    Ok(AuthResponse::UserNotFound)
                }
            }
            
        } else {
            let scopes = self.scopes.clone();
            let auth_url = self.client.auth_url(&Options {
                scope: Some(scopes),
                ..Default::default()
            });
            return Ok(AuthResponse::Redirect(auth_url.to_string()));
        }
        Ok(AuthResponse::WrongCredentials)
    }
}