use std::env;
// workflow-worker/src/runner_local.rs
use tokio::process::Command;
use std::path::PathBuf;
use std::process::ExitStatus;
use common::{run, Job};
use chrono::Utc;
use tracing::{info, error};

pub async fn start(job: &Job, server: &str, worker_id: &str) -> Result<(Vec<common::LogEntry>, bool), String> {
    let worker_path = env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    let runner_path = worker_path.parent()
        .unwrap_or_else(|| {
            error!("Failed to get parent directory of worker binary");
            std::process::exit(1);
        })
        .join("workflow-runner");

    let uuid = job.uuid.as_ref().ok_or("Job missing UUID")?;
    info!("Starting runner for job with UUID: {}", uuid);

    let mut runner_args = vec![
        "--server".to_string(), server.to_string(),
        "--job-id".to_string(), uuid.to_string(),
        "--worker-id".to_string(), worker_id.to_string(),
    ];

    if let Some(task) = &job.task {
        runner_args.push("--task".to_string());
        runner_args.push(task.clone());
    } else if let Some(action) = &job.action {
        runner_args.push("--action".to_string());
        runner_args.push(action.clone());
    } else {
        return Err("Job must specify either task or action".to_string());
    }

    if let Some(input) = &job.input {
        let input_str = serde_json::to_string(input)
            .map_err(|e| format!("Failed to serialize input: {}", e))?;
        runner_args.push("--input".to_string());
        runner_args.push(input_str);
    }

    Ok(run(runner_path.to_str().unwrap(), Some(runner_args)).await)
}