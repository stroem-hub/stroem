use std::collections::HashMap;
use std::path::PathBuf;
use anyhow::Error;
use config::Config;
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::debug;

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
