use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use anyhow::{anyhow, Error};
use blake2::{Blake2b512, Digest};
use globwalker::GlobWalkerBuilder;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig};
use tracing::{debug, error, info};
use crate::workspace_source::WorkspaceSource;
use tokio::sync::mpsc;
use tokio::time;
use tokio::time::{sleep, Instant};
use stroem_common::walk_workspace_files;

pub struct WorkspaceSourceFolder {
    pub path: PathBuf,
    pub revision: Arc<RwLock<Option<String>>>,
}

impl WorkspaceSourceFolder {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path,
            revision: Arc::new(RwLock::new(None)),
        }
    }


    pub fn calculate_revision(&self) -> Result<Option<String>, Error> {
        let mut hasher = Blake2b512::new();

        for entry in walk_workspace_files(&self.path) {
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
        Ok(Some(revision))

    }
}

impl WorkspaceSource for WorkspaceSourceFolder {
    fn get_revision(&self) -> Option<String> {
        self.revision.read().ok().and_then(|r| r.clone())
    }
    fn sync(&self) -> Result<Option<String>, Error> {
        let new_revision = self.calculate_revision()?;
        if let Ok(mut rev) = self.revision.write() {
            *rev = new_revision.clone();
        } else {
            error!("Failed to acquire write lock on revision");
        }
        Ok(new_revision)
    }

    fn watch(self: Arc<Self>, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error> {
        let watch_path = self.path.clone();
        let workspace_source = self.clone();
        let (event_tx, mut event_rx) = mpsc::channel::<()>(100);

        tokio::spawn(async move {
            let mut watcher = match RecommendedWatcher::new(
                move |res: notify::Result<notify::Event>| {
                    if let Ok(event) = res {
                        debug!("Filesystem event: {:?}", event);
                        // let _ = workspace_source.sync();
                        // callback();
                        if event.kind.is_access() {
                            debug!("Ignoring access event");
                        }
                        else {
                            let _ = event_tx.try_send(());
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
            let mut last_event_time = Instant::now();
            let mut last_sent = Instant::now();
            loop {
                tokio::select! {
                   _ = time::sleep(Duration::from_secs(5)) => {
                       debug!("Checking");
                       if last_event_time > last_sent {
                           let elapsed = Instant::now().duration_since(last_event_time);
                           if elapsed > Duration::from_secs(5) {
                               let _ = workspace_source.sync().ok();
                               callback();
                               last_sent = Instant::now();
                           }
                       }
                   }
                   Some(_) = event_rx.recv() => {
                       debug!("Received event");
                        last_event_time = Instant::now();
                   }
           }}

            loop {
                sleep(Duration::from_secs(5)).await;
            }
        });

        /*
        tokio::spawn(async move {
            let mut last_event_time = Instant::now();
            let mut last_sent = Instant::now();
            loop {
               tokio::select! {
                   _ = time::sleep(Duration::from_secs(5)) => {
                       debug!("Checking");
                       if last_event_time > last_sent {
                           let elapsed = Instant::now().duration_since(last_event_time);
                           if elapsed > Duration::from_secs(5) {
                               let _ = workspace_source.sync();
                               callback();
                               last_sent = Instant::now();
                           }
                       }
                   }
                   Some(_) = event_rx.recv() => {
                       debug!("Received event");
                        last_event_time = Instant::now();
                   }
           }}
        });

         */

        Ok(())
    }
}
