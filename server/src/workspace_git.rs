use std::path::{Path, PathBuf};
use anyhow::{Context, Error};
use config::Source;
use git2::{Cred, FetchOptions, RemoteCallbacks, Repository, ResetType};
use tokio::sync::watch;
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

    fn update_repo(&self, repo: &Repository) -> Result<(), Error> {
        let remote_url = repo
            .find_remote("origin")?
            .url()
            .context("Failed to get remote URL")?;

        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let branch = self.git_config.branch.as_ref().unwrap();

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

        // Reset the working directory to match the latest commit
        repo.reset(target_commit.as_object(), ResetType::Hard, None)
            .context("Failed to reset repository to latest commit")?;
        repo.set_head(&format!("refs/heads/{}", branch))
            .context("Failed to set HEAD to the branch")?;
        repo.checkout_head(None)
            .context("Failed to checkout HEAD")?;

        println!("Repository updated to the latest version on branch '{}'.", branch);
        Ok(())
    }

    fn clone_repo(&self) -> Result<Repository, Error> {
        let branch = self.git_config.branch.as_ref().unwrap();

        let mut fetch_options = FetchOptions::new();
        self.configure_git_callbacks(&mut fetch_options).context("Failed to configure git config")?;

        let mut builder = git2::build::RepoBuilder::new();
        builder.branch(branch);
        builder.fetch_options(fetch_options);
        let mut repo = builder.clone(self.git_config.url.as_str(), self.path.as_path())
            .context("Failed to clone repository")?;

        // Checkout the branch
        let obj = repo
            .revparse_single(&format!("refs/remotes/origin/{}", branch))
            .context("Failed to find branch reference")?;
        repo.checkout_tree(&obj, None)
            .context("Failed to checkout branch")?;
        repo.set_head(&format!("refs/heads/{}", branch))
            .context("Failed to set HEAD to the branch")?;

        drop(obj);

        println!("Repository cloned and checked out to branch '{}'.", branch);
        Ok(repo)
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
        let repo = match Repository::open(&self.path) {
            Ok(repo) => {
                self.update_repo(&repo)?;
                repo
            }
            Err(_) => {
                self.clone_repo()?
            }
        };

        let latest_commit = repo
            .head()
            .context("Failed to get repository head")?
            .target()
            .context("Failed to retrieve latest commit hash")?;

        let latest_commit_hash = latest_commit.to_string();
        println!("Latest commit hash: {}", latest_commit_hash);

        Ok(latest_commit_hash)
    }

    fn watch(&self, callback: Box<dyn Fn() + Send + Sync>) -> Result<(), Error> {
        tokio::spawn(async move {

        });
        Ok(())
    }


}