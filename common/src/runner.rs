use tracing::{info, error, debug};
use tracing_subscriber;
use crate::workflows_configuration::{WorkflowsConfiguration, Action, FlowStep};
use reqwest::Client;
use chrono::Utc;
use serde_json::{json, Value};
use std::collections::{HashMap, HashSet};
use std::ops::Deref;
use crate::{run, JobResult, log_collector::LogCollector, log_collector::LogEntry, init_tracing};
use std::path::{Path, PathBuf};
use anyhow::{anyhow, Result};
use crate::parameter_renderer::ParameterRenderer;
use crate::dag_walker::DagWalker;
use std::sync::{Arc, RwLock};
use crate::workspace_client::WorkspaceClient;


pub struct Runner {
    server: Option<String>,
    job_id: Option<String>,
    worker_id: Option<String>,
    task: Option<String>,
    action: Option<String>,
    input: Option<Value>,
    workspace: WorkspaceClient,
    workspace_revision: Option<String>,
    client: Client,
    log_collector: Arc<dyn LogCollector + Send + Sync>,
}

impl Runner {
    pub fn new(server: Option<String>, job_id: Option<String>, worker_id: Option<String>, task: Option<String>, action: Option<String>, input: Option<Value>, workspace: WorkspaceClient, workspace_revision: Option<String>, log_collector: Arc<dyn LogCollector + Send + Sync>) -> Self {
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
            log_collector,
        }
    }

    pub async fn execute(&mut self) -> anyhow::Result<bool> {
        let mut success = true;

        let workflows = self.workspace.workflows.as_ref().unwrap();

        match (self.task.clone(), self.action.clone()) {
            (Some(task), None) => {
                info!("Running task: {}", task);
                if let Some(task_def) = workflows.get_task(&task) {
                    success = self.execute_task(&task_def.flow, workflows).await?;
                } else {
                    error!("Task '{}' not found in workspace config", task);
                    success = false;
                }
            }
            (None, Some(action_name)) => {
                info!("Running action: {}", action_name);
                if let Some(action_def) = workflows.get_action(&action_name) {
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

        if !success {
            self.handle_error(None).await?;
        }

        Ok(success)
    }

    async fn handle_error(&self, step_name: Option<&str>) -> anyhow::Result<()> {

        let error_input = json!({
                "job_id": self.job_id,
                "worker_id": self.worker_id,
                "task": self.task,
                "action": self.action,
                "step_name": step_name,
            });

        let workflows = self.workspace.workflows.as_ref().unwrap();

        if let Some(task) = &self.task {
            let task = workflows.get_task(self.task.clone().unwrap().as_str()).unwrap();
            let step = task.flow.get(step_name.unwrap()).unwrap();

            if let Some(on_error_name) = &step.on_error {
                if let Some(error_action) = workflows.get_action(on_error_name) {
                    debug!("Running step-specific error handler: {}", on_error_name);
                    let _ = self.execute_action("step_error_handler", error_action, Some(error_input)).await?;
                    return Ok(());
                } else {
                    debug!("Step-specific error handler '{}' not found", on_error_name);
                }
            }
        }

        // Fall back to global error handler
        if let Some(error_handler_name) = &workflows.globals.as_ref().unwrap().error_handler {
            debug!("Running global error handler: {}", error_handler_name);
            let action = workflows.get_action(error_handler_name.as_str());
            let _ = self.execute_action("global_error_handler", action.unwrap(), Some(error_input)).await?;
        }
        Ok(())
    }

    async fn execute_task(&self, flow: &HashMap<String, FlowStep>, config: &WorkflowsConfiguration) -> anyhow::Result<bool> {
        let mut dag = DagWalker::new(flow)?; // Rename from DagExecutor
        let mut success = true;

        let mut renderer = ParameterRenderer::new();
        renderer.add_to_context(json!({"secrets": config.secrets}))?;

        if let Some(input_value) = &self.input {
            debug!("Task input: {}", input_value);
            renderer.add_to_context(json!({"input": input_value.clone()}))?;
        }

        let mut next_step = dag.get_next_step(None);
        while let Some(step_name) = next_step {
            if let Some(step) = dag.get_step(&step_name) {
                info!("Executing step: {}", step_name);

                let step_value = serde_json::to_value(&step.input)?;
                debug!("Step input before rendering: {}", step_value);
                let step_input = Some(renderer.render(step_value)?);
                debug!("Step input after rendering: {:?}", step_input);

                let (step_success, step_output) = self.execute_action(&step_name, config.get_action(&step.action).unwrap(), step_input).await?;
                if step_success {
                    if let Some(output_value) = step_output {
                        renderer.add_to_context(json!({step_name.clone(): {"output": output_value}}))?;
                    }
                }
                else {
                    self.handle_error(Some(step_name.as_str())).await?;
                    if !step.continue_on_fail.unwrap_or(false) {
                        success = false;
                        break;
                    }
                }

                next_step = dag.get_next_step(Some(step_name));
            } else {
                error!("Step '{}' not found in DAG", step_name);
                success = false;
                break;
            }
        }

        Ok(success)
    }

    async fn execute_action(&self, step_name: &str, action: &Action, step_input: Option<Value>) -> anyhow::Result<(bool, Option<Value>)> {
        // Send start with step-specific input
        let start_time = Utc::now();

        let log_collector = self.log_collector.clone();
        log_collector.set_step_name(Some(step_name.to_string())).await;

        log_collector.mark_start(start_time, &step_input).await?;

        /*
        let start_payload = json!({
            "start_datetime": start_time.to_rfc3339(),
            "input": &step_input,
        });

        self.client.post(format!("{}/jobs/{}/steps/{}/start?worker_id={}", &self.server, &self.job_id, step_name, &self.worker_id))
            .json(&start_payload)
            .send()
            .await?;
        */

        // Initialize ParameterRenderer
        let mut renderer = ParameterRenderer::new();
        if let Some(input_value) = &step_input {
            // Add step_input to context (assuming it’s an object)
            renderer.add_to_context(json!({"input": input_value}))?;
        }


        let action_value = serde_json::to_value(action)?;
        debug!("Action: {:?}", action_value);
        let action = renderer.render(action_value)?;

        debug!("Step input: {:?}", step_input);


        let cmd = action["cmd"].as_str().unwrap();
        debug!("Executing command: {}", cmd);


        /*
        let mut log_collector = LogCollector::new(
            self.server.clone(),
            self.job_id.clone(),
            self.worker_id.clone(),
            Some(step_name.to_string()),
            Some(10),
        );

         */
        let (exit_success, output) = run("sh", None, Some(cmd.to_string()), Some(&self.workspace.path), log_collector).await?;
        let end_time = Utc::now();

        let result = JobResult {
            success: exit_success,
            start_datetime: start_time,
            end_datetime: end_time,
            input: step_input.clone(), // Probably not needed, but kept for now
            output: output.clone(),
            revision: None,
        };

        self.log_collector.store_results(result).await?;
        /*
        self.client.post(format!("{}/jobs/{}/steps/{}/results?worker_id={}", self.server, self.job_id, step_name, self.worker_id))
            .json(&result)
            .send()
            .await?;
        */
        Ok((exit_success, output))
    }
}