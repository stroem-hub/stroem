use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{Context, Error, anyhow};
use strum_macros::{AsRefStr};

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub db: DbConfig,
    pub log_storage: LogStorageConfig,
    pub workspace: WorkspaceSourceConfig,
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