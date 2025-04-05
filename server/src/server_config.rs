use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{Context, Error, anyhow};
use strum_macros::{AsRefStr};

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub db: DbConfig,
    pub log_storage: LogStorageConfig,
    pub workspace: WorkspaceConfig,
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
pub struct WorkspaceConfig {
    pub folder: PathBuf, // Required for all cases
    pub git: Option<GitConfig>, // Optional, triggers Git behavior if present
}

#[derive(Debug, Deserialize, Clone)]
pub struct GitConfig {
    pub url: String,
    pub branch: Option<String>, // Defaults to "main"
    pub poll_interval: Option<u64>, // Seconds, defaults to 60
    pub auth: Option<GitAuth>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GitAuth {
    pub username: Option<String>,
    pub token: Option<String>,
    pub ssh_key: Option<String>,
}

impl ServerConfig {
    pub fn new(path: PathBuf) -> Result<Self, Error> {

        let mut cfg_builder = Config::builder();
        cfg_builder = cfg_builder.add_source(File::with_name(path.to_str().unwrap()));
        cfg_builder = cfg_builder.add_source(Environment::with_prefix("STROEM").separator("_"));
        let cfg = cfg_builder.build()
            .with_context(|| format!("Failed to build config from file: {:?}", path))?;

        cfg.try_deserialize::<Self>()
            .map_err(|e| anyhow!("Failed to deserialize config: {}", e))
    }
}