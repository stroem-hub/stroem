use std::path::{PathBuf};
use tracing::{info, debug};
use chrono::{DateTime, Duration, Utc};
use anyhow::{Error, anyhow, bail, Context};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncWriteExt, BufReader, AsyncBufReadExt};
use std::sync::Arc;
use async_compression::tokio::bufread::GzipDecoder;
use async_trait::async_trait;
use fs2::FileExt;
use tokio_stream::{self, StreamExt, wrappers::LinesStream};
use futures::Stream;
use async_compression::tokio::write::GzipEncoder;
use async_tar::Archive;
use tokio::fs;
use tokio_tar::Builder;
use tokio_util::compat::TokioAsyncReadCompatExt;
use stroem_common::{log_collector::LogEntry};
use crate::server_config::{LogStorageConfig, LogStorageType};
use std::fs::File as StdFile;

mod local;
use local::LogRepositoryLocal;

mod aws_s3;
use aws_s3::LogRepositoryAWSS3;



pub struct LogRepositoryFactory {}
impl LogRepositoryFactory {
    pub async fn new(config: &LogStorageConfig) -> Result<Arc<dyn LogRepository>, Error> {
        match &config.log_storage_type {
            LogStorageType::Local { folder} => {
                Ok(Arc::new(LogRepositoryLocal::new(PathBuf::from(config.cache_folder.clone()), PathBuf::from(folder))))
            }
            LogStorageType::S3 {
                aws_access_key_id,
                aws_secret_access_key,
                aws_region,
                bucket,
                prefix,
                endpoint,
            } => {
                Ok(Arc::new(LogRepositoryAWSS3::new(
                    PathBuf::from(&config.cache_folder),
                    aws_access_key_id.clone(),
                    aws_secret_access_key.clone(),
                    aws_region.clone(),
                    bucket.clone(),
                    prefix.clone(),
                    endpoint.clone(),
                ).await?))
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
            debug!("Log file not found in cache for job_id: {}, step_name: {:?}", job_id, step_name);

            let archive_name = self.get_cache_folder().join(format!("{}.tgz", job_id));

            let lock_file_path = self.get_cache_folder().join(format!("{}.lock", job_id));
            let std_lock_file = StdFile::create(&lock_file_path)
                .with_context(|| format!("Failed to create lock file: {}", lock_file_path.display()))?;

            std_lock_file.lock_exclusive()
                .with_context(|| format!("Failed to lock for archive unpack: {}", lock_file_path.display()))?;

            // Within lock: re-check file existence (race-safe)
            if !file_path.exists() {
                debug!("Attempting to retrieve archive: {}", archive_name.display());
                self.retrieve_archive_from_storage(job_id, &archive_name).await?;

                let file = File::open(&archive_name).await?;
                let buf_reader = BufReader::new(file);
                let gzip_decoder = GzipDecoder::new(buf_reader);
                let mut archive = Archive::new(gzip_decoder.compat());
                archive.unpack(self.get_cache_folder()).await?;
                fs::remove_file(archive_name).await?;
            }
            // Lock is released when std_lock_file is dropped
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

    async fn archive_logs_tgz(&self, job_id: &str) -> Result<PathBuf, Error> {
        // Collect matching files
        let mut entries = tokio::fs::read_dir(self.get_cache_folder()).await?;
        let mut matching_paths = vec![];

        while let Some(entry) = entries.next_entry().await? {
            let path = entry.path();
            if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
                if file_name.starts_with(job_id) && file_name.ends_with(".jsonl") {
                    matching_paths.push(path);
                }
            }
        }

        if matching_paths.is_empty() {
            bail!("No log files found to archive for job_id: {}", job_id);
        }


        // Prepare archive output
        let archive_path = self.get_cache_folder().join(format!("{}.tgz", job_id));
        let archive_file = File::create(&archive_path).await?;

        // let buffered_file = BufWriter::new(archive_file);
        let encoder = GzipEncoder::new(archive_file);
        let mut builder = Builder::new(encoder);

        for file_path in matching_paths {
            let file_name = file_path.file_name()
                .and_then(|s| s.to_str())
                .ok_or_else(|| anyhow::anyhow!("Invalid UTF-8 in file name"))?
                .to_string();

            let mut input_file = File::open(&file_path).await?;
            builder.append_file(file_name, &mut input_file).await?;

        }

        let mut encoder = builder.into_inner().await?;
        encoder.shutdown().await?;

        Ok(archive_path)
    }

    async fn upload_archive_to_storage(&self, job_id: &str, archive_name: &PathBuf) -> Result<(), anyhow::Error>;
    async fn retrieve_archive_from_storage(&self, job_id: &str, archive_name: &PathBuf) -> Result<(), anyhow::Error>;

    async fn clean_cache(&self) -> Result<(), anyhow::Error> {
        let cutoff = Utc::now() - Duration::days(15);

        let mut read_dir = fs::read_dir(self.get_cache_folder())
            .await
            .with_context(|| "Failed to read cache director".to_string())?;

        while let Some(entry) = read_dir.next_entry().await? {
            let path = entry.path();

            let metadata = fs::metadata(&path).await?;
            if !metadata.is_file() {
                continue; // skip dirs/symlinks
            }

            let modified = metadata.modified()
                .with_context(|| format!("Unable to get modification time: {}", path.display()))?;

            let modified: DateTime<Utc> = modified.into();

            if modified < cutoff {
                fs::remove_file(&path)
                    .await
                    .with_context(|| format!("Failed to delete old log file: {}", path.display()))?;
            }
        }

        Ok(())
    }

    async fn job_done(&self, job_id: &str) -> Result<(), anyhow::Error> {
        let archive_name = self.archive_logs_tgz(job_id).await?;
        self.upload_archive_to_storage(job_id, &archive_name).await?;
        fs::remove_file(&archive_name).await?;
        self.clean_cache().await?;

        Ok(())
    }

}