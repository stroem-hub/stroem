use std::collections::HashMap;
use anyhow::Error;
use async_trait::async_trait;
use serde_json::Value;
use sqlx::PgPool;
use crate::auth::{AuthProviderImpl, AuthResponse};

#[derive(Clone)]
pub struct AuthProviderOIDC {
    id: String,
    pool: PgPool
}

impl AuthProviderOIDC {
    pub fn new(id: String, pool: PgPool) -> Self {
        Self { id, pool }
    }
}

#[async_trait]
impl AuthProviderImpl for AuthProviderOIDC {
    fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    async fn authenticate(&self, payload: &HashMap<String, String>) -> Result<AuthResponse, Error> {
        Ok(AuthResponse::WrongCredentials)
    }
}