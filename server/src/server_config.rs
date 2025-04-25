use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{Context, Error, anyhow};
use reqwest::Url;
use strum_macros::{AsRefStr};

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub public_url: Url,
    pub db: DbConfig,
    pub log_storage: LogStorageConfig,
    pub workspace: WorkspaceSourceConfig,
    pub auth: AuthConfig,
}

#[derive(Debug, Deserialize)]
pub struct DbConfig {
    pub host: String,
    pub port: Option<u16>,
    pub database: String,
    pub username: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LogStorageConfig {
    pub cache_folder: PathBuf,
    #[serde(flatten)]
    pub log_storage_type: LogStorageType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "snake_case")]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum LogStorageType {
    Local {folder: PathBuf},
    S3 {
        aws_access_key_id: Option<String>,
        aws_secret_access_key: Option<String>,
        aws_region: Option<String>,
        bucket: String,
        prefix: Option<String>,
        endpoint: Option<String>,
    },
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceSourceConfig {
    pub folder: PathBuf,
    #[serde(flatten)]
    pub workspace_source_type: WorkspaceSourceType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "snake_case")]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WorkspaceSourceType {
    Folder {},
    Git {
        url: String,
        branch: Option<String>, // Defaults to "main"
        poll_interval: Option<u64>, // Seconds, defaults to 60
        auth: Option<GitAuth>,
    },
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitAuth {
    pub username: Option<String>,
    pub token: Option<String>,
    pub ssh_key: Option<String>,
    pub ssh_key_path: Option<PathBuf>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AuthConfig {
    pub jwt_secret: String,
    pub jwt_expiration: Option<u64>,
    pub refresh_token_secret: String,
    pub refresh_token_expiration: Option<u64>,
    pub auth_signup: Option<bool>,
    pub providers: HashMap<String, AuthProvider>,
    pub initial_user: Option<AuthInitialUser>
}

#[derive(Debug, Deserialize, Clone)]
pub struct AuthInitialUser {
    pub name: Option<String>,
    pub email: String,
    pub password: Option<String>,
    pub provider_id: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AuthProvider {
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub enabled: Option<bool>,
    pub primary: Option<bool>,
    pub name: Option<String>,

    #[serde(flatten)]
    pub auth_type: AuthProviderType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "lowercase")]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum AuthProviderType {
    Internal {
    },
    OIDC {
        issuer_url: String,
        client_id: String,
        client_secret: Option<String>,
        #[serde(default = "default_scopes")]
        scopes: String,
        #[serde(default = "default_name_claim")]
        name_claim: String,
        #[serde(default = "default_email_claim")]
        email_claim: String,
    },
    LDAP {
    },
}

fn default_id() -> String { "".to_string() }
fn default_scopes() -> String { "openid email profile".to_string() }
fn default_name_claim() -> String { "name".to_string() }
fn default_email_claim() -> String { "email".to_string() }



impl ServerConfig {
    pub fn new(path: PathBuf) -> Result<Self, Error> {

        let mut cfg_builder = Config::builder();
        cfg_builder = cfg_builder.add_source(File::with_name(path.to_str().unwrap()));
        cfg_builder = cfg_builder.add_source(Environment::with_prefix("STROEM").separator("_"));
        let cfg = cfg_builder.build()
            .with_context(|| format!("Failed to build config from file: {:?}", path))?;

        let mut cfg = cfg.try_deserialize::<Self>()
            .map_err(|e| anyhow!("Failed to deserialize config: {}", e))?;


        for (id, provider) in &mut cfg.auth.providers {
            provider.id = id.clone();
        }

        Ok(cfg)
    }
}