// common/src/workspace.rs
use std::path::PathBuf;
use config::{Config, File, FileFormat};
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::{Value, Map};
use std::collections::HashMap;
use anyhow::Error;
use tracing::debug;
use tera::Tera;

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
    pub path: Option<String>,
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
    pub fn new(path: &str) -> Self {
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