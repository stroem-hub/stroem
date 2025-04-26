use std::path::{Path, PathBuf};
use std::fs;
use anyhow::{anyhow, bail, Error};
use tracing::info;
use tar::{Archive};
use std::fs::{File};
use std::io::{Read, Write};
use flate2::read::GzDecoder;
use reqwest::Client;
use fs2::FileExt;
use crate::workflows_configuration::WorkflowsConfiguration;


#[derive(Clone)]
pub struct WorkspaceClient {
    pub path: PathBuf,
    pub workflows: Option<WorkflowsConfiguration>,
    pub revision: Option<String>,
}

impl WorkspaceClient {
    pub async fn new(path: PathBuf) -> Self {
        fs::create_dir_all(&path).unwrap_or_default();
        Self {
            path,
            workflows: None,
            revision: None,
        }
    }

    pub async fn sync(&mut self, server: &str) -> Result<String, Error> {
        let client = Client::new();
        let url = format!("{}/files/workspace.tar.gz", server);

        // Check revision with HEAD request
        let head_response = client.head(&url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch workspace revision: {}", e))?;

        if !head_response.status().is_success() {
            bail!("Server returned error on HEAD request: {}", head_response.status());
        }

        let revision = head_response.headers()
            .get("X-Revision")
            .and_then(|v| v.to_str().ok())
            .map(|s| s.to_string())
            .unwrap_or_else(|| "unknown".to_string());

        let rev_file = format!("{}.rev", self.path.to_string_lossy());
        let should_download = if Path::new(&rev_file).exists() {
            let mut current_rev = String::new();
            File::open(&rev_file)
                .and_then(|mut f| f.read_to_string(&mut current_rev))
                .map(|_| current_rev.trim() != revision)
                .unwrap_or(true)
        } else {
            true
        };

        if !should_download {
            info!("Workspace already up-to-date with revision {}", revision);
            self.revision = Some(revision.clone());
            return Ok(revision);
        }

        // Use file lock to ensure exclusive access across processes
        let lock_file = PathBuf::from(format!("{}.lock", self.path.to_string_lossy()));
        fs::create_dir_all(&self.path)
            .map_err(|e| anyhow!("Failed to create workspace dir: {}", e))?;
        let lock = File::create(&lock_file)
            .map_err(|e| anyhow!("Failed to create lock file {}: {}", lock_file.display(), e))?;
        lock.lock_exclusive()
            .map_err(|e| anyhow!("Failed to acquire lock on {}: {}", lock_file.display(), e))?;

        // Re-check after locking to avoid race conditions
        let should_download = if Path::new(&rev_file).exists() {
            let mut current_rev = String::new();
            File::open(&rev_file)
                .and_then(|mut f| f.read_to_string(&mut current_rev))
                .map(|_| current_rev.trim() != revision)
                .unwrap_or(true)
        } else {
            true
        };

        if !should_download {
            info!("Workspace already up-to-date with revision {} after lock", revision);
            fs2::FileExt::unlock(&lock)
                .map_err(|e| anyhow!("Failed to release lock on {}: {}", lock_file.display(), e))?;
            return Ok(revision);
        }

        fs::create_dir_all(&self.path)
            .map_err(|e| anyhow!("Failed to create workspace dir: {}", e))?;

        let response = client.get(&url)
            .send()
            .await
            .map_err(|e| anyhow!("Failed to fetch workspace tar: {}", e))?;

        if !response.status().is_success() {
            bail!("Server returned error: {}", response.status());
        }
        let tar_gz = response.bytes()
            .await
            .map_err(|e| anyhow!("Failed to read tarball bytes: {}", e))?;
        let tar = GzDecoder::new(&tar_gz[..]);
        let mut archive = Archive::new(tar);
        archive.unpack(&self.path)
            .map_err(|e| anyhow!("Failed to unpack workspace tar to {:?}: {}", &self.path, e))?;

        File::create(&rev_file)
            .and_then(|mut f| f.write_all(revision.as_bytes()))
            .map_err(|e| anyhow!("Failed to write revision file {}: {}", rev_file, e))?;

        fs2::FileExt::unlock(&lock)
            .map_err(|e| anyhow!("Failed to release lock on {}: {}", lock_file.display(), e))?;

        info!("Workspace tarball unpacked to {:?} with revision {}", &self.path, revision);
        self.revision = Some(revision.clone());
        Ok(revision)
    }

    pub fn read_workflows(&mut self) -> Result<(), Error> {
        let new_workflows = WorkflowsConfiguration::new(PathBuf::from(self.path.clone()))?;
        info!("Loaded workspace configurations: {:?}", &new_workflows);
        self.workflows = Some(new_workflows);

        Ok(())
    }

}
