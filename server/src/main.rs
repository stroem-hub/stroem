// server/src/main.rs
use clap::Parser;
use tracing::{info, error, Level};
use tracing_subscriber;
use tokio::signal;
use std::path::PathBuf;
use serde::{Serialize, Deserialize};

mod workspace;
mod scheduler;
mod queue;
mod api;

use workspace::WorkspaceConfigurationTrait;
use scheduler::Scheduler;
use queue::Queue;
use api::Api;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    task: String,
    input: serde_json::Value,
}

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = ".")]
    workspace: String,
    #[arg(short, long)]
    verbose: bool,
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    let log_level = if args.verbose { Level::TRACE } else { Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    let workspace = PathBuf::from(&args.workspace);
    if !workspace.exists() || !workspace.is_dir() {
        error!("Workspace path '{}' does not exist or is not a directory", args.workspace);
        return;
    }
    std::fs::create_dir_all(workspace.join("results")).unwrap();
    std::fs::create_dir_all(workspace.join("logs")).unwrap();

    let workflows_path = workspace.join(".workflows");
    let mut workspace_config = workspace::WorkspaceConfiguration::new(
        workflows_path.to_str().unwrap()
    );
    if let Err(e) = workspace_config.reread() {
        error!("Failed to load workspace configurations: {}", e);
        return;
    }
    info!("Loaded workspace configurations: {:?}", workspace_config);

    // Create Queue
    let queue = Queue::new(100);

    // Create Scheduler
    let mut scheduler = Scheduler::new(&queue.sender(), &workspace_config);
    scheduler.run().await; // Call run directly, no extra spawn

    // Create Api
    let api_obj = api::Api::new(queue.clone(), workspace.clone());
    tokio::spawn(async move {
        api::run(api_obj, "0.0.0.0:8080").await;
    });
    // Empty loop with graceful shutdown
    info!("Server running, waiting for shutdown signal...");
    signal::ctrl_c().await.expect("Failed to listen for shutdown signal");
    info!("Received shutdown signal, shutting down gracefully...");
    scheduler.stop().await; // Ensure scheduler stops on shutdown
}