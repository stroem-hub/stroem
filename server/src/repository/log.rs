use deadpool_postgres::Pool;
use std::path::{Path, PathBuf};
use tracing::{info, error, debug};
use chrono::{DateTime, Utc};
use serde_json::Value;
use anyhow::{Error, anyhow, bail};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncWriteExt, BufReader, AsyncBufReadExt};
use std::collections::HashMap;
use std::sync::Arc;
use async_trait::async_trait;
use fs2::FileExt;
use tokio_stream::{self, StreamExt, wrappers::LinesStream};
use futures::Stream;

use stroem_common::{JobRequest, JobResult, log_collector::LogEntry};
use crate::server_config::{LogStorageConfig, LogStorageType};

#[derive(Clone)]
pub struct LogRepositoryLocal {
    logs_dir: PathBuf,
}

impl LogRepositoryLocal {
    pub fn new(logs_dir: PathBuf) -> Self {
        Self { logs_dir }
    }

    fn get_log_file_path(&self, job_id: &str, step_name: Option<&str>) -> PathBuf {
        match step_name {
            Some(step) => self.logs_dir.join(format!("{}_{}.jsonl", job_id, step)),
            None => self.logs_dir.join(format!("{}.jsonl", job_id)),
        }
    }
}

impl LogRepository for LogRepositoryLocal {
    fn get_cache_folder(&self) -> PathBuf {
        self.logs_dir.clone()
    }
}

pub struct LogRepositoryFactory {}
impl LogRepositoryFactory {
    pub fn new(config: &LogStorageConfig) -> Result<Arc<dyn LogRepository>, Error> {
        match &config.log_storage_type {
            LogStorageType::Local { folder} => {
                Ok(Arc::new(LogRepositoryLocal::new(PathBuf::from(folder))))
            }
            _ => {
                bail!("Not implemented yet");
            }
        }
    }
}

#[async_trait]
pub trait LogRepository: Send + Sync {
    fn get_cache_folder(&self) -> PathBuf;

    fn get_log_cache_file_path(&self, job_id: &str, step_name: Option<&str>) -> PathBuf {
        match step_name {
            Some(step) => self.get_cache_folder().join(format!("{}_{}.jsonl", job_id, step)),
            None => self.get_cache_folder().join(format!("{}.jsonl", job_id)),
        }
    }

    async fn save_logs(&self, job_id: &str, step_name: Option<&str>, logs: &[LogEntry]) -> Result<(), anyhow::Error> {
        let file_path = self.get_log_cache_file_path(job_id, step_name);
        std::fs::create_dir_all(file_path.parent().unwrap())?;

        // Open file with append mode
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .await?;

        // Convert Tokio File to std::fs::File for locking (fs2 operates on std)
        let std_file = file
            .try_into_std().unwrap();

        // Acquire an exclusive lock (blocking)
        std_file
            .lock_exclusive()
            .map_err(|e| anyhow!("Failed to lock log file {}: {}", file_path.display(), e))?;

        // Convert back to Tokio File for async writing
        let mut file = File::from_std(std_file);
        let mut writer = tokio::io::BufWriter::new(&mut file);

        for log in logs {
            let line = serde_json::to_string(&log)? + "\n";
            writer.write_all(line.as_bytes()).await?;
        }
        writer.flush().await?;

        // Lock is released when std_file is dropped (end of scope)
        info!("Saved {} logs for job_id: {}, step_name: {:?}", logs.len(), job_id, step_name);
        Ok(())
    }

    async fn get_logs(&self, job_id: &str, step_name: Option<&str>) -> Result<Box<dyn Stream<Item = Result<LogEntry, anyhow::Error>> + Send + Unpin>, anyhow::Error> {
        let file_path = self.get_log_cache_file_path(job_id, step_name);

        if !file_path.exists() {
            debug!("No logs found for job_id: {}, step_name: {:?}", job_id, step_name);
            return Ok(Box::new(tokio_stream::empty()));
        }

        let file = File::open(&file_path).await?;
        let reader = BufReader::new(file);
        let lines = LinesStream::new(reader.lines());

        let stream = lines.map(|line| {
            line.map_err(anyhow::Error::from)
                .and_then(|l| serde_json::from_str(&l).map_err(anyhow::Error::from))
        });

        Ok(Box::new(stream))
    }

}