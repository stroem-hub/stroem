// workflow-runner/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use common::workspace::{WorkspaceConfiguration, WorkspaceConfigurationTrait, Action, Workspace};
use reqwest::Client;
use tar::Archive;
use flate2::read::GzDecoder;
use tempdir::TempDir;
use chrono::Utc;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use common::{run, JobResult, LogEntry};
use tera::Tera;
use std::path::{Path, PathBuf};
use std::fs::{self, File};
use std::io::{self, Write, Read};

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
        Runner { server, job_id, worker_id, task, action, input, workspace, workspace_revision, client: Client::new() }
    }

    async fn sync_workspace(&mut self) -> String {
        self.workspace.sync(&self.server).await.unwrap_or_else(|e| {
            error!("Failed to get workspace: {}", e);
            std::process::exit(1);
        })
    }

    async fn execute(&mut self) -> JobResult {
        let start_time = Utc::now();
        let revision = self.sync_workspace().await;
        let mut all_logs = Vec::new();
        let mut output = None;
        let mut exit_success = true;

        match (self.task.clone(), self.action.clone()) {
            (Some(task), None) => {
                info!("Running task: {} with job_id: {}, worker_id: {}", task, self.job_id, self.worker_id);
                if let Some(task_def) = self.workspace.config.as_ref().unwrap().get_task(&task) {
                    let (logs, success, task_output) = self.execute_task(&task_def.flow, &self.workspace.config.as_ref().unwrap(), &self.input).await;
                    all_logs.extend(logs);
                    output = task_output;
                    exit_success = success;
                } else {
                    all_logs.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: format!("Task '{}' not found in workspace config", task),
                    });
                    exit_success = false;
                }
            }
            (None, Some(action_name)) => {
                info!("Running action: {} with job_id: {}, worker_id: {}", action_name, self.job_id, self.worker_id);
                if let Some(action_def) = self.workspace.config.as_ref().unwrap().get_action(&action_name) {
                    let (logs, success, action_output) = self.execute_action(action_def, &self.input).await;
                    all_logs.extend(logs);
                    output = action_output;
                    exit_success = success;
                } else {
                    all_logs.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: format!("Action '{}' not found in workspace config", action_name),
                    });
                    exit_success = false;
                }
            }
            _ => {
                all_logs.push(LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: "Must specify either --task or --action".to_string(),
                });
                exit_success = false;
            }
        }

        let end_time = Utc::now();
        JobResult {
            worker_id: self.worker_id.clone(),
            job_id: self.job_id.clone(),
            exit_success,
            logs: all_logs,
            start_datetime: start_time,
            end_datetime: end_time,
            task: self.task.clone(),
            action: self.action.clone(),
            input: self.input.clone(),
            output,
            revision: Some(revision),
        }
    }

    async fn execute_task(&self, flow: &HashMap<String, common::workspace::FlowStep>, config: &WorkspaceConfiguration, input: &Option<Value>) -> (Vec<LogEntry>, bool, Option<Value>) {
        let mut logs = Vec::new();
        let mut visited = HashSet::new();
        let mut stack = Vec::new();
        let mut pending = Vec::new();
        let mut success = true;
        let mut task_output = None;
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

        debug!("Task input: {:?}", input);

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
                if let Some(input_value) = input {
                    context.insert("input", input_value);
                }
                for (prev_step, output) in &step_outputs {
                    let step_obj = serde_json::json!({"output": output});
                    context.insert(prev_step, &step_obj);
                }
                debug!("Step input: {:?}", &step.input);
                let step_input = if let Some(step_input) = &step.input {
                    let mut rendered_input = HashMap::new();
                    for (key, field) in step_input {
                        debug!("Step input field: {}", key);
                        let template_name = format!("{}.{}", step_name, key);
                        tera.add_raw_template(&template_name, field).unwrap_or_else(|e| error!("Failed to add template for {}: {}", key, e));
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
                    input.clone()
                };

                let (mut step_logs, step_success, step_output) = self.execute_action(config.get_action(action_name).unwrap(), &step_input).await;
                logs.append(&mut step_logs);
                task_output = step_output.clone();
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

        (logs, success, task_output)
    }

    async fn execute_action(&self, action: &Action, input: &Option<Value>) -> (Vec<LogEntry>, bool, Option<Value>) {
        let default_cmd = format!("echo Simulated SSH: {}", action.action_type);
        let cmd_template = action.cmd.as_ref().unwrap_or(&default_cmd);

        let mut tera = Tera::default();
        tera.add_raw_template("cmd", cmd_template).unwrap_or_else(|e| {
            error!("Failed to add command template: {}", e);
        });

        let mut context = tera::Context::new();
        if let Some(input_value) = input {
            context.insert("input", input_value);
        }

        debug!("Input: {:?}", input);
        debug!("cmd template: {:?}", cmd_template);

        let cmd = match tera.render("cmd", &context) {
            Ok(rendered) => rendered,
            Err(e) => {
                let errmsg = format!("Failed to render command template: {}", e);
                error!("{}", errmsg);
                return (vec![LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: errmsg,
                }], false, None);
            }
        };

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

        (logs, status, output)
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
    let result = runner.execute().await;

    common::send_result(&runner.client, &runner.server, &result).await.unwrap_or_else(|e| {
        error!("Failed to send result: {}", e);
        std::process::exit(1);
    });
}