// workflow-worker/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use tokio::time::{self, Duration};
use reqwest::Client;
use common::Job;
use std::env;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::path::PathBuf;
mod runner_local;

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
    let start_time = Utc::now();

    let (log_entries, status) = runner_local::start(job, server, worker_id)
        .await
        .map_err(|e| {
            let end_time = Utc::now();
            let logs = vec![common::LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: e.clone(),
            }];
            let _ = send_result(client, server, uuid, worker_id, false, &logs, start_time, end_time);
            e
        })?;

    let end_time = Utc::now();

    if status {
        info!("Runner completed successfully");
        send_result(client, server, uuid, worker_id, status, &log_entries, start_time, end_time).await?;
        Ok(())
    } else {
        let error_msg = "Runner failed".to_string();
        send_result(client, server, uuid, worker_id, status, &log_entries, start_time, end_time).await?;
        Err(error_msg)
    }
}

async fn send_result(client: &Client, server: &str, job_id: &str, worker_id: &str, exit_success: bool, logs: &[common::LogEntry], start_time: DateTime<Utc>, end_time: DateTime<Utc>) -> Result<(), String> {
    let url = format!("{}/jobs/results", server);
    let body = serde_json::json!({
        "worker_id": worker_id,
        "job_id": job_id,
        "exit_success": exit_success,
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