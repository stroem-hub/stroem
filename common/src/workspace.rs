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

pub trait WorkspaceConfigurationTrait {
    fn reread(&mut self) -> Result<(), Error>;
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Globals {
    pub base_path: Option<String>,
    pub error_handler: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub action_type: String,
    pub cmd: Option<String>,
    pub content: Option<String>,
    pub args: Option<String>,
    pub input: Option<HashMap<String, InputField>>,
    pub output: Option<OutputSpec>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InputField {
    #[serde(rename = "type")]
    pub field_type: String,
    pub required: Option<bool>,
    pub default: Option<Value>,
    pub description: Option<String>,
    pub order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputSpec {
    pub properties: HashMap<String, OutputProperty>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct OutputProperty {
    #[serde(rename = "type")]
    pub property_type: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Task {
    pub description: Option<String>,
    pub input: Option<HashMap<String, InputField>>,
    pub flow: HashMap<String, FlowStep>,
}

impl Task {
    pub fn get_step(&self, name: &str) -> Option<&FlowStep> {
        self.flow.get(name)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlowStep {
    pub action: String,
    pub input: Option<HashMap<String, String>>,
    pub depends_on: Option<Vec<String>>,
    #[serde(default)]  // Ensures continue_on_fail defaults to false
    pub continue_on_fail: Option<bool>,
    pub on_error: Option<String>,  // Action name reference
}

#[derive(Debug, Deserialize, Clone)]
pub struct Trigger {
    #[serde(rename = "type")]
    pub trigger_type: String,
    pub cron: Option<String>,
    pub task: String,
    pub input: Option<HashMap<String, String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct WorkflowData {
    pub globals: Option<Globals>,
    pub actions: Option<HashMap<String, Action>>,
    pub tasks: Option<HashMap<String, Task>>,
    pub triggers: Option<HashMap<String, Trigger>>,
}

#[derive(Debug, Clone)]
pub struct WorkspaceConfiguration {
    path: PathBuf,
    config: Config,
    pub workflow_data: WorkflowData,
}

impl WorkspaceConfiguration {
    pub fn new(path: PathBuf) -> Self {
        Self {
            path: PathBuf::from(path),
            config: Config::default(),
            workflow_data: WorkflowData {
                globals: None,
                actions: None,
                tasks: None,
                triggers: None,
            },
        }
    }

    pub fn reread(&mut self) -> Result<(), Error> {
        let gw = GlobWalkerBuilder::from_patterns(&self.path, &["*.yaml"])
            .max_depth(10)
            .follow_links(true)
            .sort_by(|a, b| a.path().cmp(b.path()))
            .build()?
            .into_iter()
            .filter_map(Result::ok)
            .map(|entry| config::File::from(entry.path()))
            .collect::<Vec<_>>();

        self.config = Config::builder()
            .add_source(gw)
            .build()?;

        debug!("Merged config: {:?}", self.config);

        self.workflow_data = self.config.clone().try_deserialize::<WorkflowData>()?;

        Ok(())
    }

    pub fn get_action(&self, name: &str) -> Option<&Action> {
        self.workflow_data.actions.as_ref()?.get(name)
    }

    pub fn get_task(&self, name: &str) -> Option<&Task> {
        self.workflow_data.tasks.as_ref()?.get(name)
    }
}


#[derive(Clone)]
pub struct Workspace {
    pub path: PathBuf,
    pub config: Option<WorkspaceConfiguration>,
    pub revision: Option<String>,
}

impl Workspace {
    pub fn new(path: PathBuf) -> Self {
        fs::create_dir_all(&path).unwrap_or_default();
        let mut s = Self {
            path,
            config: None,
            revision: None,
        };
        s.read_config().unwrap();
        s
    }
    pub fn read_config(&mut self) -> Result<(), Error> {
        let workflows_path = self.path.join(".workflows");
        if !workflows_path.exists() {
            bail!("Workspace configuration not found");
        }
        let mut config = WorkspaceConfiguration::new(workflows_path);
        config.reread()?;
        info!("Loaded workspace configurations: {:?}", &config);
        self.config = Some(config);

        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.path.read_dir().map(|mut i| i.next().is_none()).unwrap_or(false)
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

    pub fn get_revision(&mut self) -> Result<String, Error> {
        if self.revision.is_some() {
            return Ok(self.revision.clone().unwrap());
        }

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
                        hasher.update(format!("error:{}", e).as_bytes()); // Include error in hash
                    }
                }
            }
        }

        let revision = format!("{:x}", hasher.finalize());
        self.revision = Some(revision.clone());
        Ok(revision)
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