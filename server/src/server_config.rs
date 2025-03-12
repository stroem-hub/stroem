use serde::{Deserialize};
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{Context, Error, anyhow};

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub db: DbConfig,
    pub logs: LogsConfig,
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
pub struct LogsConfig {
    pub folder: PathBuf,
}

#[derive(Debug, Deserialize)]
pub struct WorkspaceConfig {
    pub folder: PathBuf, // Required for all cases
    pub git: Option<GitConfig>, // Optional, triggers Git behavior if present
}

#[derive(Debug, Deserialize)]
pub struct GitConfig {
    pub url: String,
    pub branch: Option<String>, // Defaults to "main"
    pub poll_interval: Option<u64>, // Seconds, defaults to 60
    pub auth: Option<GitAuth>,
}

#[derive(Debug, Deserialize)]
pub struct GitAuth {
    pub username: Option<String>,
    pub token: Option<String>,
    pub ssh_key: Option<String>,
}

impl ServerConfig {
    pub fn new(path: PathBuf) -> Result<Self, Error> {

        let mut cfg_builder = Config::builder();
        cfg_builder = cfg_builder.add_source(File::with_name(path.to_str().unwrap()));
        cfg_builder = cfg_builder.add_source(Environment::with_prefix("WF").separator("_"));
        let cfg = cfg_builder.build()
            .with_context(|| format!("Failed to build config from file: {:?}", path))?;

        cfg.try_deserialize::<Self>()
            .map_err(|e| anyhow!("Failed to deserialize config: {}", e))
    }
}