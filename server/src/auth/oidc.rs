use std::collections::HashMap;
use anyhow::Error;
use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use crate::auth::{AuthProviderImpl, AuthResponse};
use openid;
use openid::{DiscoveredClient, Options, Token};
use reqwest;
use reqwest::Url;
use tracing::info;

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

    async fn authenticate(&self, payload: &HashMap<String, String>) -> Result<AuthResponse, Error> {
        info!("Authenticating with OIDC");
        if let Some(code) = payload.get("code") {
            info!("Code: {}", code);
            let mut token: Token = self.client.request_token(code).await?.into();
            info!("Got token");
            if let Some(id_token) = token.id_token.as_mut() {
                info!("Decoding id_token");
                self.client.decode_token(id_token)?;
                info!("Validating id_token");
                self.client.validate_token(id_token, None, None)?;
                info!("token: {:?}", id_token);
            }

            let userinfo = self.client.request_userinfo(&token).await?;
            info!("userinfo: {:?}", userinfo);
        }
        else {
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