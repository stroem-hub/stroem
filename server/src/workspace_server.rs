
use std::path::{Path, PathBuf};
use config::{Config, FileFormat};
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{Value, Map};
use std::collections::HashMap;
use std::fs;
use anyhow::{anyhow, bail, Error, Context};
use tracing::{debug, error, info};
use blake2::{Blake2b512, Blake2s256, Digest};
use tar::{Builder, Archive};
use std::fs::{File};
use std::io::{Read, Write};
use flate2::write::GzEncoder;
use flate2::Compression;
use flate2::read::GzDecoder;
use fs2::FileExt;
use tokio::sync::watch;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig};
use tokio::time::{sleep, Duration}; // For watcher task loop
use std::sync::{Arc, RwLock};
use git2::{Repository, RemoteCallbacks, Cred, FetchOptions, build::RepoBuilder, ResetType};

use stroem_common::workflows_configuration::WorkflowsConfiguration;
use crate::server_config::GitConfig;
use crate::workspace_folder::WorkspaceSourceFolder;
use crate::workspace_git::WorkspaceSourceGit;


pub trait WorkspaceSource: Send + Sync {
    fn sync(&self) -> Result<String, Error>;
    fn watch(&self, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error>;
    // async fn subscribe(&self) -> Result<watch::Receiver<bool>, Error>;
    // fn get_revision(&self) -> Result<String, Error>;
}


#[derive(Clone)]
pub struct WorkspaceServer {
    pub path: PathBuf,
    // pub git_config: Option<GitConfig>,
    source: Arc<dyn WorkspaceSource + Send + Sync>,
    pub workflows: Arc<RwLock<Option<WorkflowsConfiguration>>>,
    pub revision: Arc<RwLock<Option<String>>>,
    workflows_tx: watch::Sender<Option<WorkflowsConfiguration>>, // Add sender
    workflows_rx: watch::Receiver<Option<WorkflowsConfiguration>>, // Add receiver
}

impl WorkspaceServer {
    pub async fn new(path: PathBuf, git_config: Option<GitConfig>) -> Self {
        fs::create_dir_all(&path).unwrap_or_default();
        let (workflows_tx, workflows_rx) = watch::channel(None);

        let source: Arc<dyn WorkspaceSource + Send + Sync> = match git_config {
            Some(git_config) => Arc::new(WorkspaceSourceGit::new(path.clone(), git_config)),
            None => Arc::new(WorkspaceSourceFolder::new(path.clone())),
        };
        Self {
            path,
            source,
            // git_config,
            workflows: Arc::new(RwLock::new(None)),
            revision: Arc::new(RwLock::new(None)),
            workflows_tx,
            workflows_rx,
        }
    }

    pub async fn watch(self: Arc<Self>) {
        let workspace = self.clone();
        tokio::spawn(async move {
            let callback_workspace = workspace.clone();
            if let Err(e) = workspace.source.watch(Box::new(move || {
                if let Err(e) = callback_workspace.read_workflows() {
                    error!("Failed to reload workflows: {}", e);
                }
            })) {
                error!("Failed to start watching: {}", e);
            }
        });
    }

    pub fn read_workflows(&self) -> Result<(), Error> {
        let new_workflows = WorkflowsConfiguration::new(PathBuf::from(self.path.clone()));
        info!("Loaded workspace configurations: {:?}", &new_workflows);

        if let Ok(mut workflows_guard) = self.workflows.write() {
            *workflows_guard = new_workflows.clone();
        } else {
            error!("Failed to acquire write lock on workflows");
            return Err(anyhow!("Failed to lock workflows for update"));
        }

        if let Ok(mut rev) = self.revision.write() {
            *rev = None;
        } else {
            error!("Failed to acquire write lock on revision");
            return Err(anyhow!("Failed to lock revision for reset"));
        }

        self.workflows_tx.send(new_workflows)?;
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.path.read_dir().map(|mut i| i.next().is_none()).unwrap_or(false)
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<WorkflowsConfiguration>> {
        self.workflows_rx.clone()
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

    pub fn build_tarball(&self) -> Result<Vec<u8>, Error> {
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

}