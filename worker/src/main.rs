// workflow-worker/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use tokio::time::{self, Duration};
use reqwest::Client;
use common::{Job, JobResult};
use std::env;
use uuid::Uuid;
use chrono::{DateTime, Utc};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::Semaphore;
mod runner_local;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = "http://localhost:8080")]
    server: String,
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, default_value = "5")]
    max_runners: usize,
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
    info!("Worker started with ID: {}, polling jobs from {}, max runners: {}", worker_id, args.server, args.max_runners);

    let semaphore = Arc::new(Semaphore::new(args.max_runners));

    loop {
        let permit = match semaphore.clone().acquire_owned().await {
            Ok(permit) => permit,
            Err(e) => {
                error!("Semaphore acquire failed: {}", e);
                time::sleep(Duration::from_secs(5)).await;
                continue;
            }
        };

        match poll_job(&client, &args.server, &worker_id).await {
            Ok(Some(job)) => {
                let client_clone = client.clone();
                let server = args.server.clone();
                let worker_id_clone = worker_id.clone();
                tokio::spawn(async move {
                    let _permit = permit;  // Hold the permit until this task completes
                    if let Err(e) = execute_job(&client_clone, &job, &server, &worker_id_clone).await {
                        error!("Failed to execute job {:?}: {}", job, e);
                    }
                });
            }
            Ok(None) => {
                debug!("No jobs available, waiting...");
                drop(permit);  // Release the permit if no job is available
                time::sleep(Duration::from_secs(2)).await;
            }
            Err(e) => {
                error!("Error polling job: {}", e);
                drop(permit);  // Release the permit on error
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

    let (log_entries, status) = runner_local::start(job, server, worker_id).await;
    let end_time = Utc::now();

    let result = JobResult {
            worker_id: worker_id.to_string(),
            job_id: uuid.to_string(),
            exit_success: status,
            logs: log_entries,
            start_datetime: start_time,
            end_datetime: end_time,
            task: job.task.clone(),
            action: job.action.clone(),
            input: job.input.clone(),
            output: None,
            revision: None,
    };

    common::send_result(client, server, &result).await
        .map_err(|e| {
            error!("Failed to send result for job {}: {}", uuid, e);
            e
    })?;

    if status {
        info!("Runner completed successfully");
        Ok(())
    } else {
        Err("Runner failed".to_string())
    }
}