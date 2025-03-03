// workflow-server/src/main.rs
use clap::Parser;
use tracing::{info, error, Level};
use tracing_subscriber;
use tokio::signal;
use std::path::PathBuf;

mod scheduler;
mod queue;
mod api;

use common::Job;
use common::workspace::{Workspace, WorkspaceConfiguration, WorkspaceConfigurationTrait};
use scheduler::Scheduler;
use queue::Queue;

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

    let workspace_dir = PathBuf::from(&args.workspace);
    if !workspace_dir.exists() || !workspace_dir.is_dir() {
        error!("Workspace path '{}' does not exist or is not a directory", args.workspace);
        return;
    }

    let workspace = Workspace::new(workspace_dir);

    // Create Queue
    let queue = Queue::new(100);

    // Create Scheduler
    let mut scheduler = Scheduler::new(queue.clone(), workspace.config.as_ref().unwrap());
    scheduler.run().await;

    // Create Api
    let server = api::Api::new(queue.clone(), workspace);
    tokio::spawn(async move {
        api::run(server, "0.0.0.0:8080").await;
    });

    // Empty loop with graceful shutdown
    info!("Server running, waiting for shutdown signal...");
    signal::ctrl_c().await.expect("Failed to listen for shutdown signal");
    info!("Received shutdown signal, shutting down gracefully...");
    scheduler.stop().await;
}