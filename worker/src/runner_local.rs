// workflow-worker/src/runner_local.rs
use std::env;
use common::{run, Job, log_collector::LogCollector, log_collector::LogEntry};
use chrono::Utc;
use tracing::{info, error};
use tracing::log::debug;
use anyhow::Error;
use serde_json::Value;

pub async fn start(job: &Job, server: &str, worker_id: &str, mut log_collector: LogCollector) -> Result<(bool, Option<Value>), Error> {
    let worker_path = match env::current_exe() {
        Ok(path) => path,
        Err(e) => {
            let msg = format!("Failed to get current executable path: {}", e);
            error!(msg);
            log_collector.log(Utc::now(), true, msg).await?;
            return Ok((false, None));
        }
    };
    let runner_path = match worker_path.parent() {
        Some(path) => path.join("workflow-runner"),
        None => {
            let msg = "Failed to get parent directory of worker binary".to_string();
            error!(msg);
            log_collector.log(Utc::now(), true, msg).await?;
            return Ok((false, None));
        }
    };

    let uuid = job.uuid.as_ref().unwrap();
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
        let msg = "Job must specify either task or action".to_string();
        log_collector.log(Utc::now(), true, msg).await?;
        return Ok((false, None));
    }

    if let Some(input) = &job.input {
        match serde_json::to_string(input) {
            Ok(input_str) => {
                runner_args.push("--input".to_string());
                runner_args.push(input_str);
            }
            Err(e) => {
                let msg = format!("Failed to serialize input: {}", e);
                error!(msg);
                log_collector.log(Utc::now(), true, msg).await?;
                return Ok((false, None));
            }
        }
    }

    debug!("Executing: {:?} {:?}", runner_path, runner_args);

    run(runner_path.to_str().unwrap(), Some(runner_args), None, log_collector).await
}