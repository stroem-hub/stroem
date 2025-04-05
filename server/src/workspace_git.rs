use std::path::{Path, PathBuf};
use std::sync::Arc;
use anyhow::{Context, Error};
use git2::{Cred, FetchOptions, RemoteCallbacks, Repository, ResetType, Oid};
use tokio::time::{sleep, Duration};
use tracing::{debug};
use crate::server_config::GitConfig;
use crate::workspace_server::WorkspaceSource;

pub struct WorkspaceSourceGit {
    pub path: PathBuf,
    pub git_config: GitConfig,
}

impl WorkspaceSourceGit {
    pub fn new(path: PathBuf, git_config: GitConfig) -> Self {
        Self { path, git_config }
    }

    fn update_repo(&self) -> Result<Oid, Error> {
        let repo = Repository::open(&self.path)?;
        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let binding = "main".to_string();
        let branch = self.git_config.branch.as_ref().unwrap_or(&binding);

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
        let branch = self.git_config.branch.as_ref().unwrap_or(&binding);

        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let mut builder = git2::build::RepoBuilder::new();
        builder.branch(branch);
        builder.fetch_options(fetch_options);
        let repo = builder.clone(self.git_config.url.as_str(), self.path.as_path())
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
        if let Some(auth) = &self.git_config.auth {
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
}

impl WorkspaceSource for WorkspaceSourceGit {
    fn sync(&self) -> Result<String, Error> {
        let latest_commit = match self.update_repo() {
            Ok(commit_hash) => commit_hash,
            Err(_) => self.clone_repo()?,
        };

        let latest_commit_hash = latest_commit.to_string();
        debug!("Latest commit hash: {}", latest_commit_hash);

        Ok(latest_commit_hash)
    }

    fn watch(self: Arc<Self>, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error> {
        let workspace_source = self.clone();
        let git_path = self.path.clone();
        let git_config = self.git_config.clone();
        tokio::spawn(async move {
            let interval = Duration::from_secs(git_config.poll_interval.unwrap_or(60));
            let mut last_commit: Option<Oid> = None;
            loop {
                let repo = Repository::open(&git_path).unwrap();

                let commit_hash = self.clone_repo().unwrap();
                if last_commit.is_some() && last_commit != Some(commit_hash) {
                    let _ = workspace_source.sync();
                    callback();
                }
                last_commit = Some(commit_hash);

                sleep(interval).await;
            }
        });
        Ok(())
    }
}