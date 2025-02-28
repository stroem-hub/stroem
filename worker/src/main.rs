// workflow-worker/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use tokio::time::{self, Duration};
use reqwest::Client;
use common::Job;
use std::path::PathBuf;
use std::env;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "http://localhost:8080")]
    server: String,
    #[arg(short, long)]
    verbose: bool,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    let client = Client::new();
    let worker_id = Uuid::new_v4().to_string();
    info!("Worker started with ID: {}, polling jobs from {}", worker_id, args.server);

    loop {
        match poll_job(&client, &args.server, &worker_id).await {
            Ok(Some(job)) => {
                match execute_job(&client, &job, &args.server, &worker_id).await {
                    Ok(_) => info!("Job {} executed successfully", job.uuid.as_ref().unwrap_or(&"unknown".to_string())),
                    Err(e) => error!("Failed to execute job {:?}: {}", job, e),
                }
            }
            Ok(None) => {
                debug!("No jobs available, waiting...");
                time::sleep(Duration::from_secs(2)).await;
            }
            Err(e) => {
                error!("Error polling job: {}", e);
                time::sleep(Duration::from_secs(5)).await;
            }
        }
    }
}

async fn poll_job(client: &Client, server: &str, worker_id: &str) -> Result<Option<Job>, String> {
    let url = format!("{}/jobs/next?worker_id={}", server, worker_id);
    let response = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to poll job: {}", e))?;

    if response.status().is_success() {
        let job = response.json::<Option<Job>>()
            .await
            .map_err(|e| format!("Failed to parse job: {}", e))?;
        Ok(job)
    } else {
        Err(format!("Server error: {}", response.status()))
    }
}

async fn execute_job(client: &Client, job: &Job, server: &str, worker_id: &str) -> Result<(), String> {
    let uuid = job.uuid.as_ref().ok_or("Job missing UUID")?;
    info!("Executing job with UUID: {}", uuid);

    let start_time = Utc::now();
    let worker_path = env::current_exe()
        .map_err(|e| format!("Failed to get current executable path: {}", e))?;
    let runner_path = worker_path.parent()
        .unwrap_or_else(|| {
            error!("Failed to get parent directory of worker binary");
            std::process::exit(1);
        })
        .join("workflow-runner");

    let mut cmd = tokio::process::Command::new(&runner_path);
    cmd.arg("--server").arg(server)
        .arg("--job-id").arg(uuid)
        .arg("--worker-id").arg(worker_id);

    if let Some(task) = &job.task {
        cmd.arg("--task").arg(task);
    } else if let Some(action) = &job.action {
        cmd.arg("--action").arg(action);
    } else {
        return Err("Job must specify either task or action".to_string());
    }

    if let Some(input) = &job.input {
        let input_str = serde_json::to_string(input)
            .map_err(|e| format!("Failed to serialize input: {}", e))?;
        cmd.arg("--input").arg(input_str);
    }

    let output = cmd.output()
        .await
        .map_err(|e| {
            let error_msg = format!("Failed to spawn runner at {:?}: {}", runner_path, e);
            let end_time = Utc::now();
            // Use -1 as exit status since no process ran
            let _ = send_result(client, server, uuid, worker_id, -1, &error_msg, start_time, end_time);
            error_msg
        })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let end_time = Utc::now();

    if output.status.success() {
        info!("Runner output: {}", stdout);
        send_result(client, server, uuid, worker_id, output.status.code().unwrap_or(0), &stdout, start_time, end_time).await?;
        Ok(())
    } else {
        let error_msg = format!("Runner failed: {}", stderr);
        send_result(client, server, uuid, worker_id, output.status.code().unwrap_or(-1), &error_msg, start_time, end_time).await?;
        Err(error_msg)
    }
}

async fn send_result(client: &Client, server: &str, job_id: &str, worker_id: &str, exit_status: i32, logs: &str, start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> Result<(), String> {
    let url = format!("{}/jobs/results", server);
    let body = serde_json::json!({
        "worker_id": worker_id,
        "job_id": job_id,
        "exit_status": exit_status,
        "logs": logs,
        "start_datetime": start_time,
        "end_datetime": end_time
    });

    client.post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Failed to send result: {}", e))?;
    Ok(())
}