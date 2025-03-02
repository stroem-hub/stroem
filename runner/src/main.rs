// workflow-runner/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use common::workspace::{WorkspaceConfiguration, WorkspaceConfigurationTrait, Action};
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

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    info!("Runner started for job_id: {}, worker_id: {}", args.job_id, args.worker_id);

    let start_time = Utc::now();
    let input: Option<Value> = args.input.as_ref()
        .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
            error!("Failed to parse input: {}", e);
            std::process::exit(1);
        }));

    let cache_dir = TempDir::new("workflow_runner_cache")
        .unwrap_or_else(|e| {
            error!("Failed to create temp dir: {}", e);
            std::process::exit(1);
        });

    let revision = fetch_and_unpack_workspace(&args.server, &args.workspace_dir).await.unwrap_or_else(|e| {
        error!("Failed to fetch and unpack workspace: {}", e);
        std::process::exit(1);
    });

    let mut workspace_config = WorkspaceConfiguration::new(PathBuf::from(&args.workspace_dir));
    workspace_config.reread().unwrap_or_else(|e| {
        error!("Failed to read workspace config: {}", e);
        std::process::exit(1);
    });

    let client = Client::new();
    let mut all_logs = Vec::new();
    let mut output = None;
    let mut exit_success = true;

    match (args.task.clone(), args.action.clone()) {
        (Some(task), None) => {
            info!("Running task: {} with job_id: {}, worker_id: {}", task, args.job_id, args.worker_id);
            if let Some(tasks) = &workspace_config.workflow_data.tasks {
                if let Some(task_def) = tasks.get(&task) {
                    let (logs, success, task_output) = execute_task(&task_def.flow, &workspace_config, &input).await;
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
            } else {
                all_logs.push(LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: "No tasks defined in workspace config".to_string(),
                });
                exit_success = false;
            }
        }
        (None, Some(action_name)) => {
            info!("Running action: {} with job_id: {}, worker_id: {}", action_name, args.job_id, args.worker_id);
            if let Some(actions) = &workspace_config.workflow_data.actions {
                if let Some(action_def) = actions.get(&action_name) {
                    let (logs, success, action_output) = execute_action(action_def, &input).await;
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
            } else {
                all_logs.push(LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: "No actions defined in workspace config".to_string(),
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
    let result = JobResult {
        worker_id: args.worker_id.clone(),
        job_id: args.job_id.clone(),
        exit_success,
        logs: all_logs,
        start_datetime: start_time,
        end_datetime: end_time,
        task: args.task,
        action: args.action,
        input,
        output,
        revision: Some(revision),
    };

    common::send_result(&client, &args.server, &result).await.unwrap_or_else(|e| {
        error!("Failed to send result: {}", e);
        std::process::exit(1);
    });
}

async fn fetch_and_unpack_workspace(server: &str, workspace_dir: &String) -> Result<String, String> {
    let client = Client::new();
    let url = format!("{}/files/workspace.tar.gz", server);

    // Check revision with HEAD request
    let head_response = client.head(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch workspace revision: {}", e))?;

    if !head_response.status().is_success() {
        return Err(format!("Server returned error on HEAD request: {}", head_response.status()));
    }

    let revision = head_response.headers()
        .get("X-Revision")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| "unknown".to_string());

    let rev_file = format!("{}.rev", workspace_dir);
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

    fs::create_dir_all(workspace_dir)
        .map_err(|e| format!("Failed to create workspace dir: {}", e))?;

    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch workspace tar: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Server returned error: {}", response.status()));
    }
    let tar_gz = response.bytes()
        .await
        .map_err(|e| format!("Failed to read tarball bytes: {}", e))?;
    let tar = GzDecoder::new(&tar_gz[..]);
    let mut archive = Archive::new(tar);
    archive.unpack(workspace_dir)
        .map_err(|e| format!("Failed to unpack workspace tar to {:?}: {}", workspace_dir, e))?;

    File::create(&rev_file)
        .and_then(|mut f| f.write_all(revision.as_bytes()))
        .map_err(|e| format!("Failed to write revision file {}: {}", rev_file, e))?;

    info!("Workspace tarball unpacked to {:?} with revision {}", workspace_dir, revision);
    Ok(revision)
}

async fn execute_task(flow: &HashMap<String, common::workspace::FlowStep>, config: &WorkspaceConfiguration, input: &Option<Value>) -> (Vec<LogEntry>, bool, Option<Value>) {
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
        if visited.contains(&step_name) {
            continue;
        }
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
            let action = &step.action;
            if let Some(actions) = &config.workflow_data.actions {

                let mut tera = Tera::default();
                let mut context = tera::Context::new();

                // Add task inputs to context
                if let Some(input_value) = input {
                    context.insert("input", input_value);
                }
                // Add previous steps outputs
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
                        tera.add_raw_template(&template_name, &field)
                            .unwrap_or_else(|e| error!("Failed to add template for {}: {}", key, e));
                        match tera.render(&template_name, &context) {
                            Ok(value) => {
                                rendered_input.insert(key.clone(), Value::String(value));
                            }
                            Err(e) => {
                                error!("Failed to render step {}: {}", key, e);
                                logs.push(LogEntry {
                                    timestamp: Utc::now(),
                                    is_stderr: true,
                                    message: format!("Failed to render input '{}': {}", key, e),
                                });
                                success = false;
                            }
                        }
                    }
                    Some(Value::Object(rendered_input.into_iter().collect()))
                } else {
                    input.clone()
                };

                let (mut step_logs, step_success, step_output) = execute_action(actions.get(action).unwrap(), &step_input).await;
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
        }
        stack.pop();
        visited.insert(step_name);
    }

    (logs, success, task_output)
}

async fn execute_action(action: &Action, input: &Option<Value>) -> (Vec<LogEntry>, bool, Option<Value>) {
    let default_cmd = format!("echo Simulated SSH: {}", action.action_type);
    let cmd_template = action.cmd.as_ref()
        .unwrap_or(&default_cmd);

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
            error!(errmsg);
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: errmsg,
            }], false, None);
        }
    };


    debug!("Executing command: {}", cmd);


    let (logs, status) = run("sh", Some(vec!["-c".to_string(), cmd])).await;

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