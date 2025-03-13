use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;
use anyhow::{anyhow, Error};
use blake2::{Blake2b512, Digest};
use globwalker::GlobWalkerBuilder;
use notify::{RecommendedWatcher, RecursiveMode, Watcher, Config as NotifyConfig};
use tracing::{debug, error, info};
use crate::workspace_server::WorkspaceSource;
use tokio::sync::mpsc;
use tokio::time;
use tokio::time::{sleep, Instant};

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
}

impl WorkspaceSource for WorkspaceSourceFolder {
    fn sync(&self) -> Result<String, Error> {
        self.get_revision()
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
                        let _ = event_tx.try_send(());
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
