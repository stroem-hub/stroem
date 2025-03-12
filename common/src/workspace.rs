// common/src/workspace.rs
use std::path::{Path, PathBuf};
use config::{Config, FileFormat};
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{Value, Map};
use std::collections::HashMap;
use std::fs;
use anyhow::{anyhow, bail, Error};
use tracing::{debug, error, info};
use tera::Tera;
use blake2::{Blake2b512, Blake2s256, Digest};
use tar::{Builder, Archive};
use std::fs::{File};
use std::io::{Read, Write};
use flate2::write::GzEncoder;
use flate2::Compression;
use flate2::read::GzDecoder;
use reqwest::Client;
use fs2::FileExt;
use tokio::sync::watch;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig}; // Add notify imports
use tokio::time::{sleep, Duration}; // For watcher task loop
use std::sync::{Arc, RwLock};

use crate::workflows_configuration::WorkflowsConfiguration;

#[derive(Clone)]
pub struct Workspace {
    pub path: PathBuf,
    pub config: Option<WorkflowsConfiguration>,
    pub revision: Arc<RwLock<Option<String>>>,
    config_tx: watch::Sender<Option<WorkflowsConfiguration>>, // Add sender
    config_rx: watch::Receiver<Option<WorkflowsConfiguration>>, // Add receiver
}

impl Workspace {
    pub async fn new(path: PathBuf) -> Self {
        fs::create_dir_all(&path).unwrap_or_default();
        let config = WorkflowsConfiguration::new(path.clone());
        let (config_tx, config_rx) = watch::channel(config.clone());
        let mut s = Self {
            path,
            config,
            revision: Arc::new(RwLock::new(None)),
            config_tx,
            config_rx,
        };
        s.read_config().unwrap();
        s
    }

    pub async fn watch(&self) {
        let watch_path = self.path.clone();
        let watcher_path = self.path.clone();
        let revision = Arc::clone(&self.revision);
        let config_tx = self.config_tx.clone();
        tokio::spawn(async move {
            let mut watcher = match RecommendedWatcher::new(
                move |res: notify::Result<notify::Event>| {
                    if let Ok(event) = res {
                        debug!("Filesystem event: {:?}", event);
                        let workflows_path = watcher_path.join(".workflows");
                        let config = WorkflowsConfiguration::new(workflows_path);
                        if let Some(cfg) = config {
                            if let Err(e) = config_tx.send(Some(cfg)) {
                                error!("Failed to broadcast config update: {}", e);
                            }

                            if let Ok(mut rev) = revision.write() {
                                *rev = None;
                            } else {
                                error!("Failed to acquire write lock on revision");
                            }
                        }
                    }
                },
                NotifyConfig::default(),
            ) {
                Ok(w) => w,
                Err(e) => {
                    error!("Failed to create filesystem watcher: {}", e);
                    return;
                }
            };

            if let Err(e) = watcher.watch(watch_path.as_path(), RecursiveMode::Recursive) {
                error!("Failed to watch directory {:?}: {}", watch_path, e);
                return;
            }

            // Keep the task alive
            loop {
                sleep(Duration::from_secs(5)).await;
            }
        });
    }

    pub fn read_config(&mut self) -> Result<(), Error> {
        let workflows_path = self.path.join(".workflows");
        if !workflows_path.exists() {
            bail!("Workspace configuration not found");
        }
        let mut config = WorkflowsConfiguration::new(workflows_path);
        info!("Loaded workspace configurations: {:?}", &config);
        self.config = config.clone();

        self.config_tx.send(config)?;

        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.path.read_dir().map(|mut i| i.next().is_none()).unwrap_or(false)
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<WorkflowsConfiguration>> {
        self.config_rx.clone()
    }

    fn walk_files(&self) -> Vec<globwalker::DirEntry> {
        let walker = GlobWalkerBuilder::from_patterns(&self.path, &["**/*"])
            .max_depth(10)
            .follow_links(true)
            .build()
            .unwrap();
        let mut entries: Vec<_> = walker.into_iter().filter_map(Result::ok).collect();
        entries.sort_by(|a, b| a.path().cmp(b.path()));
        entries
    }

    pub fn get_revision(&self) -> Result<String, Error> {
        let mut rev_guard = self.revision.write().map_err(|e| anyhow!("Failed to lock revision: {}", e))?;
        if rev_guard.is_none() {
            let mut hasher = Blake2b512::new();

            for entry in self.walk_files() {
                let path = entry.path();
                if path.is_file() {
                    let relative_path = path.strip_prefix(&self.path).unwrap().to_string_lossy();
                    hasher.update(relative_path.as_bytes());

                    match fs::read(path) {
                        Ok(contents) => hasher.update(&contents),
                        Err(e) => {
                            error!("Failed to read file {}: {}", path.display(), e);
                            hasher.update(format!("error:{}", e).as_bytes());
                        }
                    }
                }
            }

            let revision = format!("{:x}", hasher.finalize());
            *rev_guard = Some(revision.clone());
            Ok(revision)
        } else {
            Ok(rev_guard.clone().unwrap())
        }
    }

    pub fn build_tarball(&mut self) -> Result<Vec<u8>, Error> {
        let mut tarball = Vec::new();
        let mut builder = Builder::new(&mut tarball);

        for entry in self.walk_files() {
            let file_path = entry.path();
            if file_path.is_file() {
                let relative_path = file_path.strip_prefix(&self.path).unwrap();
                let mut file = File::open(file_path).unwrap();
                builder.append_file(relative_path, &mut file).unwrap();
            }
        }

        builder.finish().unwrap();
        drop(builder); // Explicitly drop builder to release mutable borrow

        let mut gzipped = Vec::new();
        let mut encoder = GzEncoder::new(&mut gzipped, Compression::default());
        encoder.write_all(&tarball)?;
        encoder.finish()?;

        Ok(gzipped)
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
        Ok(revision)
    }

}