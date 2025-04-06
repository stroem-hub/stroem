mod folder;
use folder::WorkspaceSourceFolder;

mod git;
use git::WorkspaceSourceGit;

use std::sync::Arc;
use anyhow::Error;
use crate::repository::LogRepository;
use crate::server_config::{WorkspaceSourceConfig, WorkspaceSourceType};

pub trait WorkspaceSource: Send + Sync {
    fn sync(&self) -> Result<String, Error>;
    fn watch(self: Arc<Self>, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error>;
    // async fn subscribe(&self) -> Result<watch::Receiver<bool>, Error>;
    // fn get_revision(&self) -> Result<String, Error>;
}

pub struct WorkspaceSourceFactory {}
impl WorkspaceSourceFactory {
    pub async fn new(config: &WorkspaceSourceConfig) -> Result<Arc<dyn WorkspaceSource>, Error> {
        match &config.workspace_source_type {
            WorkspaceSourceType::Folder {} => {
                Ok(Arc::new(WorkspaceSourceFolder::new(
                    config.folder.clone()
                )))
            },
            WorkspaceSourceType::Git {url, branch, poll_interval, auth} => {
                Ok(Arc::new(WorkspaceSourceGit::new(
                    config.folder.clone(), url.clone(), branch.clone(), poll_interval.clone(), auth.clone()
                )))
            }
        }
    }
}