use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use anyhow::{Context, Error};
use git2::{Cred, FetchOptions, RemoteCallbacks, Repository, ResetType, Oid};
use tokio::time::{sleep, Duration};
use tracing::{debug};
use crate::server_config::GitAuth;
use crate::workspace_source::WorkspaceSource;

pub struct WorkspaceSourceGit {
    pub path: PathBuf,
    pub revision: Arc<RwLock<Option<String>>>,
    pub url: String,
    pub branch: Option<String>, // Defaults to "main"
    pub poll_interval: Option<u64>, // Seconds, defaults to 60
    pub auth: Option<GitAuth>,
}

impl WorkspaceSourceGit {
    pub fn new(path: PathBuf, url: String, branch: Option<String>, poll_interval: Option<u64>, auth: Option<GitAuth>) -> Self {
        Self {
            path,
            revision: Arc::new(RwLock::new(None)),
            url,
            branch,
            poll_interval,
            auth
        }
    }

    fn update_repo(&self) -> Result<Oid, Error> {
        let repo = Repository::open(&self.path)?;
        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let binding = "main".to_string();
        let branch = self.branch.as_ref().unwrap_or(&binding);

        let mut remote = repo.find_remote("origin")?;
        remote.fetch(&[branch], Some(&mut fetch_options), None)
            .context("Failed to fetch latest changes")?;

        let fetch_head = repo
            .find_reference(&format!("refs/remotes/origin/{}", branch))
            .context("Failed to find fetched branch reference")?;
        let target = fetch_head
            .target()
            .context("Invalid fetch head target")?;

        let target_commit = repo.find_commit(target)
            .context("Failed to find commit for the fetched branch")?;

        repo.reset(target_commit.as_object(), ResetType::Hard, None)
            .context("Failed to reset repository to latest commit")?;
        repo.set_head(&format!("refs/heads/{}", branch))
            .context("Failed to set HEAD to the branch")?;
        repo.checkout_head(None)
            .context("Failed to checkout HEAD")?;

        debug!("Repository updated to commit {} on branch '{}'.", target, branch);
        Ok(target)
    }

    fn clone_repo(&self) -> Result<Oid, Error> {
        let binding = "main".to_string();
        let branch = self.branch.as_ref().unwrap_or(&binding);

        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let mut builder = git2::build::RepoBuilder::new();
        builder.branch(branch);
        builder.fetch_options(fetch_options);
        let repo = builder.clone(self.url.as_str(), self.path.as_path())
            .context("Failed to clone repository")?;

        // Checkout the branch
        let obj = repo
            .revparse_single(&format!("refs/remotes/origin/{}", branch))
            .context("Failed to find branch reference")?;
        repo.checkout_tree(&obj, None)
            .context("Failed to checkout branch")?;
        repo.set_head(&format!("refs/heads/{}", branch))
            .context("Failed to set HEAD to the branch")?;

        // Get the commit hash (Oid) of the HEAD
        let commit_hash = repo
            .head()
            .context("Failed to get repository head")?
            .target()
            .context("Failed to retrieve latest commit hash")?;

        drop(obj);

        debug!("Repository cloned and checked out to commit {} on branch '{}'.", commit_hash, branch);
        Ok(commit_hash)
    }

    fn configure_git_callbacks(&self, fetch_options: &mut FetchOptions) -> Result<(), Error> {
        if let Some(auth) = &self.auth {
            let mut callbacks = RemoteCallbacks::new();

            if let Some(ssh_key) = auth.ssh_key.clone() {
                let username = auth.username.clone().unwrap_or_else(|| "git".to_string());
                callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                    Cred::ssh_key(
                        &username,
                        None,
                        Path::new(&ssh_key),
                        None
                    )
                });
            } else if let (Some(username), Some(token)) = (auth.username.clone(), auth.token.clone()) {
                callbacks.credentials(move |_url, _username_from_url, _allowed_types| {
                    Cred::userpass_plaintext(&username, &token)
                });
            }

            fetch_options.remote_callbacks(callbacks);
        }
        Ok(())
    }

    fn sync_repo(&self) -> Result<Oid, Error> {
        match self.update_repo() {
            Ok(commit_hash) => Ok(commit_hash),
            Err(_) => self.clone_repo(),
        }
    }

    fn set_revision(&self, revision: &Option<Oid>) -> Result<(), Error> {
        let mut rev_guard = self.revision.write().map_err(|_| "Failed to acquire write lock on revision").unwrap();
        *rev_guard = match revision {
            Some(last_commit_id) => {Some(last_commit_id.to_string().clone())},
            None => {None}
        };
        Ok(())
    }
}

impl WorkspaceSource for WorkspaceSourceGit {
    fn get_revision(&self) -> Option<String> {
        self.revision.read().ok().and_then(|r| r.clone())
    }

    fn sync(&self) -> Result<Option<String>, Error> {
        let latest_commit = self.sync_repo();
        let revision = match latest_commit {
            Ok(commit_hash) => Some(commit_hash),
            Err(_) => None,
        };
        self.set_revision(&revision)?;

        let revision = match revision {
            Some(commit_hash) => Some(commit_hash.to_string()),
            None => None
        };

        Ok(revision)
    }

    fn watch(self: Arc<Self>, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error> {
        tokio::spawn(async move {
            let workspace_source = self.clone();
            let interval = Duration::from_secs(self.poll_interval.unwrap_or(60));
            let mut last_commit: Option<Oid> = None;
            loop {
                let latest_commit = self.sync_repo();
                let commit_hash = latest_commit.ok().or(None);
                self.set_revision(&commit_hash).unwrap();

                if last_commit != commit_hash {
                    callback();
                }
                last_commit = commit_hash;

                sleep(interval).await;
            }
        });
        Ok(())
    }
}