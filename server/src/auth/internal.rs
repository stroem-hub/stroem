use std::collections::HashMap;
use uuid::Uuid;
use anyhow::{Error, anyhow};
use serde::{Deserialize, Serialize};
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

    async fn authenticate(&self, payload: &HashMap<String, String>, auto_signup: bool) -> Result<AuthResponse, Error> {
        let email = match payload.get("email") {
            Some(e) if !e.is_empty() => e,
            _ => return Ok(AuthResponse::WrongCredentials),
        };

        let password = match payload.get("password") {
            Some(p) if !p.is_empty() => p,
            _ => return Ok(AuthResponse::WrongCredentials),
        };

        let user = sqlx::query("SELECT user_id, name, password_hash FROM \"user\" WHERE email = $1")
            .bind(&email)
            .fetch_optional(&self.pool)
            .await?;

        match user {
            Some(u) => {
                let password_hash: Option<String> = u.try_get("password_hash")?;
                let hash = match password_hash {
                    Some(hash) => hash,
                    None => return Ok(AuthResponse::WrongCredentials),
                };
                if !verify_password(&password, &hash)? {
                    return Ok(AuthResponse::WrongCredentials);
                }
                let user = User {
                    user_id: u.get::<Uuid, &str>("user_id").clone(),
                    name: u.get::<Option<String>, &str>("name").clone(),
                    email: email.to_string()
                };
                self.create_link(&self.id, &user.user_id, None).await?;
                Ok(AuthResponse::Success(user))
            }
            None => {
                if auto_signup {
                    // Add user
                    let user_id = self.add_user(&email, None, Some(password)).await?;
                    let user = User {
                        user_id,
                        name: None,
                        email: email.to_string(),
                    };
                    self.create_link(&self.id, &user.user_id, None).await?;
                    return Ok(AuthResponse::Success(user));
                }
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