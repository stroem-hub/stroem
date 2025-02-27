// workflow-worker/src/main.rs
use clap::Parser;
use tracing::{info, error, debug};
use tracing_subscriber;
use tokio::time::{self, Duration};
use reqwest::Client;
use common::Job;
use std::path::PathBuf;
use std::env;

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
    info!("Worker started, polling jobs from {}", args.server);

    loop {
        match poll_job(&client, &args.server).await {
            Ok(Some(job)) => {
                if let Err(e) = execute_job(&job, &args.server).await {
                    error!("Failed to execute job {:?}: {}", job, e);
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

async fn poll_job(client: &Client, server: &str) -> Result<Option<Job>, String> {
    let url = format!("{}/jobs/next", server);
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

async fn execute_job(job: &Job, server: &str) -> Result<(), String> {
    let uuid = job.uuid.as_ref().ok_or("Job missing UUID")?;
    info!("Executing job with UUID: {}", uuid);

    // Get the directory of the current executable (worker binary)
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
        .arg("--job-id").arg(uuid);

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
        .map_err(|e| format!("Failed to spawn runner at {:?}: {}", runner_path, e))?;

    if output.status.success() {
        info!("Runner output: {}", String::from_utf8_lossy(&output.stdout));
        Ok(())
    } else {
        Err(format!("Runner failed: {}", String::from_utf8_lossy(&output.stderr)))
    }
}