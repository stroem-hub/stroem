// workflow-worker/src/runner_local.rs
use std::env;
use common::{run, Job, LogEntry};
use chrono::Utc;
use tracing::{info, error};

pub async fn start(job: &Job, server: &str, worker_id: &str) -> (Vec<LogEntry>, bool) {
    let worker_path = match env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            error!("Failed to get current executable path: {}", e);
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: format!("Failed to get current executable path: {}", e),
            }], false);
        }
    };
    let runner_path = match worker_path.parent() {
        Some(path) => path.join("workflow-runner"),
        None => {
            error!("Failed to get parent directory of worker binary");
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: "Failed to get parent directory of worker binary".to_string(),
            }], false);
        }
    };

    let uuid = match job.uuid.as_ref() {
        Some(uuid) => uuid,
        None => {
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: "Job missing UUID".to_string(),
            }], false);
        }
    };
    info!("Starting runner for job with UUID: {}", uuid);

    let mut runner_args = vec![
        "--server".to_string(), server.to_string(),
        "--job-id".to_string(), uuid.to_string(),
        "--worker-id".to_string(), worker_id.to_string(),
        "--verbose".to_string(),
    ];

    if let Some(task) = &job.task {
        runner_args.push("--task".to_string());
        runner_args.push(task.clone());
    } else if let Some(action) = &job.action {
        runner_args.push("--action".to_string());
        runner_args.push(action.clone());
    } else {
        return (vec![LogEntry {
            timestamp: Utc::now(),
            is_stderr: true,
            message: "Job must specify either task or action".to_string(),
        }], false);
    }

    if let Some(input) = &job.input {
        match serde_json::to_string(input) {
            Ok(input_str) => {
                runner_args.push("--input".to_string());
                runner_args.push(input_str);
            }
            Err(e) => {
                return (vec![LogEntry {
                    timestamp: Utc::now(),
                    is_stderr: true,
                    message: format!("Failed to serialize input: {}", e),
                }], false);
            }
        }
    }

    let (logs, success) = run(runner_path.to_str().unwrap(), Some(runner_args)).await;
    (logs, success)
}