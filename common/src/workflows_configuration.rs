use std::collections::HashMap;
use std::path::PathBuf;
use anyhow::{anyhow, bail, Error};
use config::Config;
use globwalker::GlobWalkerBuilder;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{debug, error};
use std::process::Command;
use strum::{AsRefStr};


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Globals {
    pub base_path: Option<String>,
    pub error_handler: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Action {
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub input: Option<HashMap<String, InputField>>,
    pub output: Option<OutputSpec>,
    #[serde(flatten)]
    pub action_type: ActionType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "snake_case")]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ActionType {
    Shell {
        cmd: Option<String>,
    },
    RemoteShell {}, // TODO
    Docker {}, // TODO
    Pod {}, // TODO
    Python {
        script: Option<String>,
    }, // TODO
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InputField {
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub required: Option<bool>,
    pub description: Option<String>,
    pub order: Option<i32>,

    #[serde(flatten)]
    pub field_type: InputFieldType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "lowercase")]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum InputFieldType {
    String {
        default: Option<String>,
    },
    Int {
        default: Option<i32>,
    }
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
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub name: Option<String>,
    pub description: Option<String>,
    pub input: Option<HashMap<String, InputField>>,
    pub flow: HashMap<String, FlowStep>,
}

fn default_id() -> String { "".to_string() }

impl Task {
    pub fn get_step(&self, name: &str) -> Option<&FlowStep> {
        self.flow.get(name)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FlowStep {
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub name: Option<String>,
    pub action: String,
    pub input: Option<HashMap<String, String>>,
    pub depends_on: Option<Vec<String>>,
    #[serde(default)]  // Ensures continue_on_fail defaults to false
    pub continue_on_fail: Option<bool>,
    pub on_error: Option<String>,  // Action name reference
}

#[derive(Debug, Deserialize, Clone)]
pub struct Trigger {
    #[serde(skip_deserializing, default = "default_id")]
    pub id: String,
    pub task: String,
    pub input: Option<HashMap<String, String>>,
    pub enabled: Option<bool>,

    #[serde(flatten)]
    pub trigger_type: TriggerType,
}

#[derive(Debug, Serialize, Deserialize, Clone, AsRefStr)]
#[strum(serialize_all = "snake_case")]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum TriggerType {
    Scheduler {
        cron: String,
    },
}

#[derive(Debug, Deserialize, Clone)]
#[derive(Default)]
pub struct WorkflowsConfiguration {
    pub globals: Option<Globals>,
    pub actions: Option<HashMap<String, Action>>,
    pub tasks: Option<HashMap<String, Task>>,
    pub triggers: Option<HashMap<String, Trigger>>,
    pub secrets: Option<Value>,
}

impl WorkflowsConfiguration {
    pub fn new(workspace_path: PathBuf) -> Result<Self, Error> {
        let workflows_path = workspace_path.join(".workflows");
        if !workflows_path.exists() {
            bail!("Workspace configuration not found");
        }

        // Build the glob walker for both *.yaml and *.sops.yaml files
        let gw = match GlobWalkerBuilder::from_patterns(&workflows_path, &["*.yaml", "*.sops.yaml"])
            .max_depth(10)
            .follow_links(true)
            .sort_by(|a, b| a.path().cmp(b.path()))
            .build()
        {
            Ok(walker) => walker,
            Err(e) => bail!("Failed to build glob walker: {}", e),
        };

        let mut config_builder = Config::builder();

        // Process each file from the glob walker asynchronously
        for entry in gw.into_iter().filter_map(Result::ok) {
            let path = entry.path();
            let _ = if path.extension().and_then(|s| s.to_str()) == Some("sops.yaml") {
                // Decrypt SOPS file asynchronously
                let decrypted_content = decrypt_sops_file(path)?;
                config_builder = config_builder.add_source(config::File::from_str(&decrypted_content, config::FileFormat::Yaml));
            } else {
                // Regular YAML file
                config_builder = config_builder.add_source(config::File::from(path));
            };
        }

        // Build the config
        let config = match config_builder.build() {
            Ok(config) => config,
            Err(e) => bail!("Failed to build config: {}", e),
        };

        debug!("Merged config: {:?}", config);

        // Deserialize to Self
        let mut cfg = match config.try_deserialize::<Self>() {
            Ok(cfg) => cfg,
            Err(e) => bail!("Failed to deserialize config: {}", e),
        };

        if let Some(actions) = &mut cfg.actions {
            for (id, action) in actions {
                action.id = id.clone();
                if let Some(inputs) = &mut action.input {
                    for (input_id, input) in inputs {
                        input.id = input_id.clone();
                    }
                }
            }
        }

        if let Some(tasks) = &mut cfg.tasks {
            for (id, task) in tasks {
                task.id = id.clone();
                for (step_id, step) in &mut task.flow {
                    step.id = step_id.clone();
                }
                if let Some(inputs) = &mut task.input {
                    for (input_id, input) in inputs {
                        input.id = input_id.clone();
                    }
                }
            }
        }

        if let Some(triggers) = &mut cfg.triggers {
            for (id, trigger) in triggers {
                trigger.id = id.clone();
            }
        }

        Ok(cfg)
    }

    pub fn try_new_or_empty(workspace_path: PathBuf) -> Self {
        Self::new(workspace_path).unwrap_or_else(|e| {
            error!("Failed to load config, using empty configuration: {e}");
            Self { ..Default::default() }
        })
    }

    pub fn validate(&self) -> Result<(), Error> {
        // Validate triggers if present
        if let Some(triggers) = &self.triggers {
            for (trigger_name, trigger) in triggers {
                let _ = self.get_task(&trigger.task)
                    .ok_or_else(|| anyhow!("Trigger '{}' references non-existent task '{}'", trigger_name, trigger.task))?;
            }
        }

        // Validate tasks and their steps if present
        if let Some(tasks) = &self.tasks {
            for (task_name, task) in tasks {
                for (step_name, step) in &task.flow {
                    self.get_action(&step.action)
                        .ok_or_else(|| anyhow!("Step '{}' in task '{}' references non-existent action '{}'", step_name, task_name, step.action))?;
                    if let Some(on_error) = &step.on_error {
                        self.get_action(on_error)
                            .ok_or_else(|| anyhow!("Step '{}' in task '{}' has on_error '{}' referencing non-existent action", step_name, task_name, on_error))?;
                    }
                }
            }
        }

        // Validate global error handler if present
        if let Some(globals) = &self.globals {
            if let Some(error_handler) = &globals.error_handler {
                self.get_action(error_handler)
                    .ok_or_else(|| anyhow!("Global error handler '{}' references non-existent action", error_handler))?;
            }
        }

        Ok(())
    }

    pub fn get_action(&self, name: &str) -> Option<&Action> {
        self.actions.as_ref()?.get(name)
    }

    pub fn get_task(&self, name: &str) -> Option<&Task> {
        self.tasks.as_ref()?.get(name)
    }
}

/// Decrypt a SOPS-encrypted YAML file using the `sops` command-line tool.
fn decrypt_sops_file(path: &std::path::Path) -> Result<String, Error> {
    let output = Command::new("sops")
        .arg("-d") // Decrypt flag
        .arg(path)
        .output()
        .map_err(|e| anyhow::anyhow!("Failed to execute sops: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        bail!("SOPS decryption failed: {}", stderr);
    }

    let decrypted_content = String::from_utf8(output.stdout)
        .map_err(|e| anyhow::anyhow!("Failed to parse decrypted content: {}", e))?;
    Ok(decrypted_content)
}