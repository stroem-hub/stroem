use crate::repository::LogRepository;
use async_trait::async_trait;
use std::path::PathBuf;
use anyhow::Error;
use tokio::fs;

#[derive(Clone)]
pub struct LogRepositoryLocal {
    cache_dir: PathBuf,
    storage_dir: PathBuf,
}

impl LogRepositoryLocal {
    pub fn new(cache_dir: PathBuf, storage_dir: PathBuf) -> Self {
        Self { cache_dir, storage_dir }
    }

    fn _get_log_file_path(&self, job_id: &str, step_name: Option<&str>) -> PathBuf {
        match step_name {
            Some(step) => self.cache_dir.join(format!("{}_{}.jsonl", job_id, step)),
            None => self.cache_dir.join(format!("{}.jsonl", job_id)),
        }
    }
}
#[async_trait]
impl LogRepository for LogRepositoryLocal {
    fn get_cache_folder(&self) -> PathBuf {
        self.cache_dir.clone()
    }

    async fn upload_archive_to_storage(&self, _job_id: &str, archive_name: &PathBuf) -> Result<(), Error> {
        let filename = archive_name.file_name().unwrap();
        fs::copy(archive_name, self.storage_dir.join(filename)).await?;
        Ok(())
    }

    async fn retrieve_archive_from_storage(&self, _job_id: &str, archive_name: &PathBuf) -> Result<(), Error> {
        let filename = archive_name.file_name().unwrap();
        fs::copy(self.storage_dir.join(filename), archive_name).await?;
        Ok(())
    }
}
