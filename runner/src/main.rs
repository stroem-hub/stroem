use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use stroem_common::workspace::{WorkspaceConfiguration, WorkspaceConfigurationTrait, Action, Workspace, FlowStep};
use reqwest::Client;
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use stroem_common::{run, JobResult, log_collector::LogCollector, log_collector::LogEntry, init_tracing};
use tera::Tera;
use std::path::{Path, PathBuf};
use anyhow::{anyhow, Result};
use stroem_common::parameter_renderer::ParameterRenderer;
use stroem_common::dag_walker::DagWalker;



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

    async fn execute(&mut self) -> Result<bool> {
        let mut success = true;

        match (self.task.clone(), self.action.clone()) {
            (Some(task), None) => {
                info!("Running task: {} with job_id: {}, worker_id: {}", task, self.job_id, self.worker_id);
                if let Some(task_def) = self.workspace.config.as_ref().unwrap().get_task(&task) {
                    success = self.execute_task(&task_def.flow, self.workspace.config.as_ref().unwrap()).await?;
                } else {
                    error!("Task '{}' not found in workspace config", task);
                    success = false;
                }
            }
            (None, Some(action_name)) => {
                info!("Running action: {} with job_id: {}, worker_id: {}", action_name, self.job_id, self.worker_id);
                if let Some(action_def) = self.workspace.config.as_ref().unwrap().get_action(&action_name) {
                    let (action_success, _) = self.execute_action(&action_name, action_def, self.input.clone()).await?;
                    success = action_success;
                } else {
                    error!("Action '{}' not found in workspace config", action_name);
                    success = false;
                }
            }
            _ => {
                error!("Must specify either --task or --action");
                success = false;
            }
        }

        Ok(success)
    }

    async fn execute_task(&self, flow: &HashMap<String, FlowStep>, config: &WorkspaceConfiguration) -> Result<bool> {
        let mut dag = DagWalker::new(flow)?; // Rename from DagExecutor
        let mut success = true;

        let mut renderer = ParameterRenderer::new();
        if let Some(input_value) = &self.input {
            renderer.add_to_context(json!({"input": input_value.clone()}))?;
        }

        let mut next_step = dag.get_next_step(None, true);
        while let Some(step_name) = next_step {
            if let Some(step) = dag.get_step(&step_name) {
                info!("Executing step: {}", step_name);

                let step_value = serde_json::to_value(&step.input)?;
                let step_input = Some(renderer.render(step_value)?);

                let (step_success, step_output) = self.execute_action(&step_name, config.get_action(&step.action).unwrap(), step_input).await?;
                if step_success {
                    if let Some(output_value) = step_output {
                        renderer.add_to_context(json!({step_name.clone(): {"output": output_value}}))?;
                    }
                }

                success &= step_success;
                next_step = dag.get_next_step(Some(step_name), step_success);
            } else {
                error!("Step '{}' not found in DAG", step_name);
                success = false;
                break;
            }
        }

        Ok(success)
    }

    async fn execute_action(&self, step_name: &str, action: &Action, step_input: Option<Value>) -> Result<(bool, Option<Value>)> {
        // Send start with step-specific input
        let start_time = Utc::now();
        let start_payload = json!({
            "start_datetime": start_time.to_rfc3339(),
            "input": &step_input,
        });

        self.client.post(format!("{}/jobs/{}/steps/{}/start?worker_id={}", &self.server, &self.job_id, step_name, &self.worker_id))
            .json(&start_payload)
            .send()
            .await?;

        // Initialize ParameterRenderer
        let mut renderer = ParameterRenderer::new();
        if let Some(input_value) = &step_input {
            // Add step_input to context (assuming it’s an object)
            renderer.add_to_context(json!({"input": input_value}))?;
        }

        let action_value = serde_json::to_value(action)?;
        let action = renderer.render(action_value)?;

        debug!("Step input: {:?}", step_input);

        let cmd = action["cmd"].as_str().unwrap();
        debug!("Executing command: {}", cmd);

        let mut log_collector = LogCollector::new(
            self.server.clone(),
            self.job_id.clone(),
            self.worker_id.clone(),
            Some(step_name.to_string()),
            Some(10),
        );
        let (exit_success, output) = run("sh", Some(vec!["-c".to_string(), cmd.to_string()]), Some(&self.workspace.path), log_collector).await?;
        let end_time = Utc::now();

        let result = JobResult {
            exit_success,
            start_datetime: start_time,
            end_datetime: end_time,
            input: step_input.clone(), // Probably not needed, but kept for now
            output: output.clone(),
            revision: None,
        };

        self.client.post(format!("{}/jobs/{}/steps/{}/results?worker_id={}", self.server, self.job_id, step_name, self.worker_id))
            .json(&result)
            .send()
            .await?;

        Ok((exit_success, output))
    }
}

#[tokio::main]
async fn main() {
    let args = Args::parse();

    init_tracing(args.verbose);
    /*
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

     */

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
    let success = runner.execute().await.unwrap_or_else(|e| {
        error!("Execution failed: {}", e);
        false
    });

    if !success {
        std::process::exit(1);
    }
}