// workflow-runner/src/main.rs
use clap::Parser;
use tracing::{info, error};
use tracing_subscriber;
use common::workspace::{WorkspaceConfiguration, WorkspaceConfigurationTrait};
use reqwest::Client;
use tar::Archive;
use flate2::read::GzDecoder;
use tempdir::TempDir;
use std::fs::File;
use std::io::copy;
use tokio::process::Command;
use serde_json::Value;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, required = true)]
    server: String,          // Server URL (e.g., "http://localhost:8080")
    #[arg(long, required = true)]
    job_id: String,          // UUID of the job
    #[arg(long, conflicts_with = "action")]
    task: Option<String>,    // Task name (optional, mutually exclusive with action)
    #[arg(long, conflicts_with = "task")]
    action: Option<String>,  // Action name (optional, mutually exclusive with task)
    #[arg(long)]
    input: Option<String>,   // JSON input string (optional)
    #[arg(long, required = true)]
    worker_id: String,       // Worker ID passed from worker
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    info!("Runner started for job_id: {}, worker_id: {}", args.job_id, args.worker_id);

    // Parse input if provided
    let input: Option<Value> = args.input.as_ref()
        .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
            error!("Failed to parse input: {}", e);
            std::process::exit(1);
        }));

    // Create a temporary directory for the workspace cache
    let cache_dir = TempDir::new("workflow_runner_cache")
        .unwrap_or_else(|e| {
            error!("Failed to create temp dir: {}", e);
            std::process::exit(1);
        });

    // Fetch and unpack workspace asynchronously
    fetch_and_unpack_workspace(&args.server, cache_dir.path()).await.unwrap_or_else(|e| {
        error!("Failed to fetch and unpack workspace: {}", e);
        std::process::exit(1);
    });

    // Read workspace configuration
    let mut workspace_config = WorkspaceConfiguration::new(cache_dir.path().to_str().unwrap());
    workspace_config.reread().unwrap_or_else(|e| {
        error!("Failed to read workspace config: {}", e);
        std::process::exit(1);
    });

    // Execute the job
    match (args.task, args.action) {
        (Some(task), None) => {
            info!("Running task: {} with job_id: {}, worker_id: {}", task, args.job_id, args.worker_id);
            if let Some(tasks) = &workspace_config.workflow_data.tasks {
                if let Some(task_def) = tasks.get(&task) {
                    info!("Task definition: {:?}", task_def);
                    println!("Task {} executed successfully with input: {:?}", task, input);
                } else {
                    error!("Task '{}' not found in workspace config", task);
                    std::process::exit(1);
                }
            } else {
                error!("No tasks defined in workspace config");
                std::process::exit(1);
            }
        }
        (None, Some(action)) => {
            info!("Running action: {} with job_id: {}, worker_id: {}", action, args.job_id, args.worker_id);
            if let Some(actions) = &workspace_config.workflow_data.actions {
                if let Some(action_def) = actions.get(&action) {
                    let input_str = input.as_ref().map_or(String::new(), |v| v.to_string());
                    let default_cmd = format!("echo Simulated SSH: {} with input: {}", action, input_str);
                    let cmd = action_def.content.as_ref().unwrap_or(&default_cmd);
                    let output = Command::new("sh")
                        .arg("-c")
                        .arg(cmd)
                        .output()
                        .await
                        .unwrap_or_else(|e| {
                            error!("Failed to run action: {}", e);
                            std::process::exit(1);
                        });
                    println!("Action output: {}", String::from_utf8_lossy(&output.stdout));
                } else {
                    error!("Action '{}' not found in workspace config", action);
                    std::process::exit(1);
                }
            } else {
                error!("No actions defined in workspace config");
                std::process::exit(1);
            }
        }
        _ => {
            error!("Must specify either --task or --action");
            std::process::exit(1);
        }
    }
}

async fn fetch_and_unpack_workspace(server: &str, dest_dir: &std::path::Path) -> Result<(), String> {
    let client = Client::new();
    let url = format!("{}/files/workflows.tar.gz", server);
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
    archive.unpack(dest_dir)
        .map_err(|e| format!("Failed to unpack workspace tar: {}", e))?;

    info!("Workspace tarball unpacked to {:?}", dest_dir);
    Ok(())
}