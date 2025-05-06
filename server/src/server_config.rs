use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{Context, Error, anyhow};
use reqwest::Url;
use strum::{AsRefStr};
use std::time::Duration;
use duration_str::deserialize_duration;

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub public_url: Url,
    pub db: DbConfig,
    pub log_storage: LogStorageConfig,
    pub workspace: WorkspaceSourceConfig,
    pub auth: AuthConfig,
    pub worker_token: String
}

#[derive(Debug, Deserialize)]
pub struct DbConfig {
    pub host: String,
    #[serde(default = "default_db_port")]
    pub port: u16,
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
        #[serde(default = "default_git_branch")]
        branch: String,
        #[serde(default="default_git_poll_interval", deserialize_with = "deserialize_duration")]
        poll_interval: Duration,
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
    #[serde(default="default_jwt_expiration", deserialize_with = "deserialize_duration")]
    pub jwt_expiration: Duration,
    pub refresh_token_secret: String,
    #[serde(default="default_refresh_token_expiration", deserialize_with = "deserialize_duration")]
    pub refresh_token_expiration: Duration,
    #[serde(default = "default_false")]
    pub auto_signup: bool,
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
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_false")]
    pub primary: bool,
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

fn default_true() -> bool { true }
fn default_false() -> bool { false }

fn default_db_port() -> u16 { 5432 }

fn default_git_branch() -> String { "main".to_string() }
fn default_git_poll_interval() -> Duration { Duration::from_secs(60) }
fn default_scopes() -> String { "openid email profile".to_string() }
fn default_name_claim() -> String { "name".to_string() }
fn default_email_claim() -> String { "email".to_string() }

fn default_jwt_expiration() -> Duration { Duration::from_secs(15*60) }
fn default_refresh_token_expiration() -> Duration { Duration::from_secs(30 * 24 * 3600) }



impl ServerConfig {
    pub fn new(path: PathBuf) -> Result<Self, Error> {

        let mut cfg_builder = Config::builder();
        cfg_builder = cfg_builder.add_source(File::with_name(path.to_str().unwrap()));
        cfg_builder = cfg_builder.add_source(Environment::with_prefix("STROEM").separator("__"));
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