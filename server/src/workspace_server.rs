
use std::path::{PathBuf};
use std::fs;
use anyhow::{anyhow, Error};
use tracing::{error, info};
use tokio::sync::watch; // For watcher task loop
use std::sync::{Arc, RwLock};
use tokio::fs::File;
use async_compression::tokio::write::GzipEncoder;
use tokio::io::AsyncWriteExt;
use stroem_common::workflows_configuration::WorkflowsConfiguration;
use crate::server_config::WorkspaceSourceConfig;
use crate::workspace_source::{WorkspaceSource, WorkspaceSourceFactory};
use stroem_common::walk_workspace_files;



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
    pub async fn new(config: WorkspaceSourceConfig) -> Self {
        fs::create_dir_all(&config.folder).unwrap_or_default();
        let (workflows_tx, workflows_rx) = watch::channel(None);

        let source = WorkspaceSourceFactory::new(&config).await.unwrap();
        /*
        let source: Arc<dyn WorkspaceSource + Send + Sync> = match git_config {
            Some(git_config) => Arc::new(WorkspaceSourceGit::new(path.clone(), git_config)),
            None => Arc::new(WorkspaceSourceFolder::new(path.clone())),
        };
        */
        Self {
            path: config.folder,
            source,
            // git_config,
            workflows: Arc::new(RwLock::new(None)),
            revision: Arc::new(RwLock::new(None)),
            workflows_tx,
            workflows_rx,
        }
    }

    pub async fn sync(&self) -> Result<Option<String>, Error> {
        self.source.sync()
    }

    pub async fn watch(self: Arc<Self>) {
        let workspace = self.clone();
        let source = self.source.clone();
        tokio::spawn(async move {
            let callback_workspace = workspace.clone();
            if let Err(e) = source.watch(Box::new(move || {
                if let Err(e) = callback_workspace.read_workflows() {
                    error!("Failed to reload workflows: {}", e);
                }
            })) {
                error!("Failed to start watching: {}", e);
            }
        });
    }

    pub fn read_workflows(&self) -> Result<(), Error> {
        let new_workflows = WorkflowsConfiguration::try_new_or_empty(PathBuf::from(self.path.clone()));
        info!("Loaded workspace configurations: {:?}", &new_workflows);

        if let Ok(mut workflows_guard) = self.workflows.write() {
            *workflows_guard = Some(new_workflows.clone());
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

        self.workflows_tx.send(Some(new_workflows))?;
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.path.read_dir().map(|mut i| i.next().is_none()).unwrap_or(false)
    }

    pub fn subscribe(&self) -> watch::Receiver<Option<WorkflowsConfiguration>> {
        self.workflows_rx.clone()
    }


    pub fn get_revision(&self) -> Option<String> {
        self.source.get_revision()
    }


    pub async fn build_tarball(&self) -> Result<Vec<u8>, Error> {
        let tarball = Vec::new();
        // let mut builder = Builder::new(&mut tarball);

        let encoder = GzipEncoder::new(tarball);
        let mut builder = tokio_tar::Builder::new(encoder);

        for entry in walk_workspace_files(&self.path) {
            let file_path = entry.path();
            if file_path.is_file() {
                let relative_path = file_path.strip_prefix(&self.path).unwrap();
                let mut file = File::open(file_path).await?;
                builder.append_file(relative_path, &mut file).await?;
            }
        }

        let mut encoder = builder.into_inner().await?;
        encoder.shutdown().await?;
        let tarball = encoder.into_inner();

        Ok(tarball)
    }

}