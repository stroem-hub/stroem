use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use common::workspace::{WorkspaceConfiguration, WorkspaceConfigurationTrait, Action, Workspace, FlowStep};
use reqwest::Client;
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use common::{run, JobResult, LogEntry};
use tera::Tera;
use std::path::{Path, PathBuf};
use anyhow::Result;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, required = true)]
    server: String,
    #[arg(long, required = true)]
    job_id: String,
    #[arg(long, conflicts_with = "action")]
    task: Option<String>,
    #[arg(long, conflicts_with = "task")]
    action: Option<String>,
    #[arg(long)]
    input: Option<String>,
    #[arg(long, required = true)]
    worker_id: String,
    #[arg(long, default_value = "/tmp/workspace")]
    workspace_dir: String,
}

struct Runner {
    server: String,
    job_id: String,
    worker_id: String,
    task: Option<String>,
    action: Option<String>,
    input: Option<Value>,
    workspace: Workspace,
    workspace_revision: String,
    client: Client,
}

impl Runner {
    fn new(server: String, job_id: String, worker_id: String, task: Option<String>, action: Option<String>, input: Option<Value>, workspace: Workspace, workspace_revision: String) -> Self {
        Runner {
            server,
            job_id,
            worker_id,
            task,
            action,
            input,
            workspace,
            workspace_revision,
            client: Client::new(),
        }
    }

    async fn execute(&mut self) -> Result<(Vec<LogEntry>, bool)> {
        let mut all_logs = Vec::new();
        let mut success = true;

        match (self.task.clone(), self.action.clone()) {
            (Some(task), None) => {
                info!("Running task: {} with job_id: {}, worker_id: {}", task, self.job_id, self.worker_id);
                if let Some(task_def) = self.workspace.config.as_ref().unwrap().get_task(&task) {
                    let (logs, task_success) = self.execute_task(&task_def.flow, self.workspace.config.as_ref().unwrap()).await?;
                    all_logs.extend(logs);
                    success = task_success;
                } else {
                    all_logs.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: format!("Task '{}' not found in workspace config", task),
                    });
                    success = false;
                }
            }
            (None, Some(action_name)) => {
                info!("Running action: {} with job_id: {}, worker_id: {}", action_name, self.job_id, self.worker_id);
                if let Some(action_def) = self.workspace.config.as_ref().unwrap().get_action(&action_name) {
                    let (logs, action_success, _) = self.execute_action(&action_name, action_def, self.input.clone()).await?;
                    all_logs.extend(logs);
                    success = action_success;
                } else {
                    all_logs.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: format!("Action '{}' not found in workspace config", action_name),
                    });
                    success = false;
                }
            }
            _ => {
                all_logs.push(LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: "Must specify either --task or --action".to_string(),
                });
                success = false;
            }
        }

        Ok((all_logs, success))
    }

    async fn execute_task(&self, flow: &HashMap<String, FlowStep>, config: &WorkspaceConfiguration) -> Result<(Vec<LogEntry>, bool)> {
        let mut logs = Vec::new();
        let mut visited = HashSet::new();
        let mut stack = Vec::new();
        let mut pending = Vec::new();
        let mut success = true;
        let mut step_outputs: HashMap<String, Value> = HashMap::new();

        let mut graph: HashMap<String, Vec<String>> = HashMap::new();
        for (step_name, step) in flow {
            let mut next_steps = Vec::new();
            if let Some(next) = &step.on_success {
                next_steps.push(next.clone());
            }
            if let Some(next) = &step.on_fail {
                next_steps.push(next.clone());
            }
            graph.insert(step_name.clone(), next_steps);
        }

        let mut incoming: HashMap<String, usize> = HashMap::new();
        for (step, next_steps) in &graph {
            incoming.entry(step.clone()).or_insert(0);
            for next in next_steps {
                *incoming.entry(next.clone()).or_insert(0) += 1;
            }
        }
        pending.extend(incoming.iter()
            .filter(|(_, count)| **count == 0)
            .map(|(step, _)| step.clone()));

        debug!("Task input: {:?}", self.input);

        while let Some(step_name) = pending.pop() {
            if visited.contains(&step_name) { continue; }
            if stack.contains(&step_name) {
                logs.push(LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: format!("Cycle detected at step '{}'", step_name),
                });
                success = false;
                break;
            }
            stack.push(step_name.clone());

            if let Some(step) = flow.get(&step_name) {
                info!("Executing step: {}", step_name);
                let action_name = &step.action;

                let mut tera = Tera::default();
                let mut context = tera::Context::new();
                if let Some(input_value) = &self.input {
                    context.insert("input", input_value);
                }
                for (prev_step, output) in &step_outputs {
                    let step_obj = serde_json::json!({"output": output});
                    context.insert(prev_step, &step_obj);
                }
                debug!("Step input template: {:?}", &step.input);
                let step_input = if let Some(step_input) = &step.input {
                    let mut rendered_input = HashMap::new();
                    for (key, field) in step_input {
                        debug!("Step input field: {}", key);
                        let template_name = format!("{}.{}", step_name, key);
                        tera.add_raw_template(&template_name, field)?;
                        match tera.render(&template_name, &context) {
                            Ok(value) => rendered_input.insert(key.clone(), Value::String(value)),
                            Err(e) => {
                                error!("Failed to render step {}: {}", key, e);
                                logs.push(LogEntry {
                                    timestamp: Utc::now(),
                                    is_stderr: true,
                                    message: format!("Failed to render input '{}': {}", key, e),
                                });
                                success = false;
                                None
                            }
                        };
                    }
                    Some(Value::Object(rendered_input.into_iter().collect()))
                } else {
                    self.input.clone()
                };

                let (mut step_logs, step_success, step_output) = self.execute_action(&step_name, config.get_action(action_name).unwrap(), step_input).await?;
                logs.append(&mut step_logs);
                if step_success {
                    if let Some(output_value) = step_output {
                        step_outputs.insert(step_name.clone(), output_value);
                    }
                    if let Some(next) = &step.on_success {
                        pending.push(next.clone());
                    }
                } else {
                    success = false;
                    if let Some(next) = &step.on_fail {
                        pending.push(next.clone());
                    } else {
                        break;
                    }
                }
            }
            stack.pop();
            visited.insert(step_name);
        }

        Ok((logs, success))
    }

    async fn execute_action(&self, step_name: &str, action: &Action, input: Option<Value>) -> Result<(Vec<LogEntry>, bool, Option<Value>)> {
        // Send start
        let start_time = Utc::now();
        let payload = json!({
            "start_datetime": start_time.to_rfc3339(),
            "input": &input,
        });

        let result = self.client.post(format!("{}/jobs/{}/steps/{}/start?worker_id={}", &self.server, &self.job_id, step_name, &self.worker_id))
            .json(&payload)
            .send()
            .await?;

        debug!("{:?}", result);
        debug!("{:?}", result.text().await?);


        let default_cmd = format!("echo Simulated SSH: {}", action.action_type);
        let cmd_template = action.cmd.as_ref().unwrap_or(&default_cmd);

        let mut tera = Tera::default();
        tera.add_raw_template("cmd", cmd_template)?;

        let mut context = tera::Context::new();
        if let Some(input_value) = &input {
            context.insert("input", input_value);
        }

        debug!("Input: {:?}", self.input);
        debug!("cmd template: {:?}", cmd_template);

        let cmd = tera.render("cmd", &context)?;
        debug!("Executing command: {}", cmd);

        let (logs, status) = run("sh", Some(vec!["-c".to_string(), cmd]), Some(&self.workspace.path)).await;

        let mut output_lines = Vec::new();
        for log in logs.iter().filter(|log| !log.is_stderr && log.message.starts_with("OUTPUT:")) {
            output_lines.push(log.message.strip_prefix("OUTPUT:").unwrap().trim());
        }
        debug!("Output: {:?}", output_lines);
        let output = if output_lines.is_empty() {
            None
        } else {
            let joined_output = output_lines.join("\n");
            match serde_json::from_str(&joined_output) {
                Ok(json) => Some(json),
                Err(e) => {
                    error!("Failed to parse OUTPUT as JSON: {}", e);
                    Some(Value::String(joined_output))
                }
            }
        };

        let end_time = Utc::now();


        let result = JobResult {
            exit_success: status,
            start_datetime: start_time,
            end_datetime: end_time,
            input: input.clone(), // probably also not needed
            output: output.clone(),
            revision: None,
        };


        let url = format!("{}/jobs/{}/steps/{}/results?worker_id={}", self.server, self.job_id, step_name, self.worker_id);
        debug!("{}", url);
        let result = self.client.post(&url)
            .json(&result)
            .send()
            .await?;

        debug!("{:?}", result);
        debug!("{:?}", result.text().await?);


        Ok((logs, status, output))
    }
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    info!("Runner started for job_id: {}, worker_id: {}", args.job_id, args.worker_id);

    let input: Option<Value> = args.input.as_ref()
        .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
            error!("Failed to parse input: {}", e);
            std::process::exit(1);
        }));

    let mut workspace = Workspace::new(PathBuf::from(&args.workspace_dir));
    let revision = workspace.sync(&args.server).await.unwrap_or_else(|e| {
        error!("Failed to get workspace: {}", e);
        std::process::exit(1);
    });

    let mut runner = Runner::new(
        args.server,
        args.job_id,
        args.worker_id,
        args.task,
        args.action,
        input,
        workspace,
        revision,
    );
    let (logs, success) = runner.execute().await.unwrap_or_else(|e| {
        error!("Execution failed: {}", e);
        (vec![LogEntry {
            timestamp: Utc::now(),
            is_stderr: true,
            message: format!("Execution failed: {}", e),
        }], false)
    });

    if !success {
        std::process::exit(1);
    }
}