// common/src/workspace.rs
use std::path::PathBuf;
use config::{Config, FileFormat};
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{Value, Map};
use std::collections::HashMap;
use std::fs;
use anyhow::{bail, Error};
use tracing::{debug, error, info};
use tera::Tera;
use blake2::{Blake2b512, Blake2s256, Digest};
use tar::{Builder, Archive};
use std::fs::{File};
use std::io::Write;
use flate2::write::GzEncoder;
use flate2::Compression;

pub trait WorkspaceConfigurationTrait {
    fn reread(&mut self) -> Result<(), Error>;
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Globals {
    pub base_path: Option<String>,
    pub error_handler: Option<ErrorHandler>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorHandler {
    pub path: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
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

#[derive(Debug, Deserialize)]
pub struct InputField {
    #[serde(rename = "type")]
    pub field_type: String,
    pub required: Option<bool>,
    pub default: Option<Value>,
    pub description: Option<String>,
    pub order: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct OutputSpec {
    pub properties: HashMap<String, OutputProperty>,
}

#[derive(Debug, Deserialize)]
pub struct OutputProperty {
    #[serde(rename = "type")]
    pub property_type: String,
}

#[derive(Debug, Deserialize)]
pub struct Task {
    pub description: Option<String>,
    pub input: Option<HashMap<String, InputField>>,
    pub flow: HashMap<String, FlowStep>,
}

#[derive(Debug, Deserialize)]
pub struct FlowStep {
    pub action: String,
    pub input: Option<HashMap<String, String>>,
    pub on_success: Option<String>,
    pub on_fail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Trigger {
    #[serde(rename = "type")]
    pub trigger_type: String,
    pub cron: Option<String>,
    pub task: String,
    pub input: Option<HashMap<String, String>>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct WorkflowData {
    pub globals: Option<Globals>,
    pub actions: Option<HashMap<String, Action>>,
    pub tasks: Option<HashMap<String, Task>>,
    pub triggers: Option<HashMap<String, Trigger>>,
}

#[derive(Debug)]
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
}

impl WorkspaceConfigurationTrait for WorkspaceConfiguration {
    fn reread(&mut self) -> Result<(), Error> {
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
}

pub struct Workspace {
    pub path: PathBuf,
    pub config: Option<WorkspaceConfiguration>,
    pub revision: Option<String>,
}

impl Workspace {
    pub fn new(path: &str) -> Self {
        fs::create_dir_all(path).unwrap_or_default();
        let path = PathBuf::from(path);
        let mut s = Self {
            path,
            config: None,
            revision: None,
        };
        s.read_config().unwrap_or(Default::default());
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
        Ok(())
    }

    pub fn is_empty(&self) -> bool {
        self.path.read_dir().map(|mut i| i.next().is_none()).unwrap_or(false)
    }

    pub fn get_revision(&mut self) -> String {
        let mut hasher = Blake2b512::new();

        let walker = GlobWalkerBuilder::from_patterns(&self.path, &["**/*"])
            .max_depth(10)
            .follow_links(true)
            .build()
            .unwrap();

        let mut entries: Vec<_> = walker.into_iter().filter_map(Result::ok).collect();
        entries.sort_by(|a, b| a.path().cmp(b.path())); // Ensure deterministic order

        for entry in entries {
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
        revision
    }

    pub fn build_tarball(&mut self) -> Vec<u8> {
        let mut tarball = Vec::new();
        let mut builder = Builder::new(&mut tarball);

        let walker = GlobWalkerBuilder::from_patterns(&self.path, &["**/*"])
            .max_depth(10)
            .follow_links(true)
            .build()
            .unwrap();

        for entry in walker.into_iter().filter_map(Result::ok) {
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
        encoder.write_all(&tarball).unwrap();
        encoder.finish().unwrap();

        gzipped
    }

}