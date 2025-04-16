use uuid::Uuid;
use anyhow::{Error, bail, anyhow};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{PgPool, Row};
use crate::auth::{AuthProviderImpl, AuthResponse, User};
use argon2::{
    Argon2,
    PasswordHash,
    PasswordHasher,
    PasswordVerifier,
    password_hash::{
        rand_core::OsRng,
        SaltString,
    },
};
use async_trait::async_trait;

#[derive(Clone)]
pub struct AuthProviderInternal {
    id: String,
    pool: PgPool
}

impl AuthProviderInternal {
    pub fn new(id: String, pool: PgPool) -> Self {
        Self { id, pool }
    }
}

#[derive(Clone, Serialize, Deserialize)]
pub struct AuthInternalCredentials {
    pub email: String,
    pub password: String,
}

#[async_trait]
impl AuthProviderImpl for AuthProviderInternal {
    fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    async fn authenticate(&self, payload: &Option<Value>) -> Result<AuthResponse, Error> {
        let credentials: AuthInternalCredentials = match payload {
            Some(value) => serde_json::from_value(value.clone())?,
            None => return Ok(AuthResponse::WrongCredentials),
        };
        if credentials.email.is_empty() || credentials.password.is_empty() {
            return Ok(AuthResponse::WrongCredentials);
        }

        let user = sqlx::query("SELECT user_id, name, password_hash FROM user WHERE email = $1")
            .bind(&credentials.email)
            .fetch_optional(&self.pool)
            .await?;

        match user {
            Some(u) => {
                let password_hash: Option<String> = u.try_get("password_hash")?;
                let hash = match password_hash {
                    Some(hash) => hash,
                    None => return Ok(AuthResponse::WrongCredentials),
                };
                if !verify_password(&credentials.password, &hash)? {
                    return Ok(AuthResponse::WrongCredentials);
                }
                let user = User {
                    user_id: u.get::<Uuid, &str>("user_id").clone(),
                    name: u.get::<Option<String>, &str>("name").clone(),
                    email: credentials.email.clone()
                };
                self.create_link(&self.id, &user.user_id, None).await?;
                Ok(AuthResponse::Success(user))
            }
            None => {
                Ok(AuthResponse::UserNotFound)
            }
        }
    }
}

pub fn hash_password(password: &str) -> Result<String, Error> {
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| anyhow!("Failed to hash password: {}", e))?
        .to_string();
    Ok(password_hash)
}

fn verify_password(password: &str, hash: &str) -> Result<bool, Error> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| anyhow!("Invalid password hash: {}", e))?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed_hash)
        .is_ok())
}