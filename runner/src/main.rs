use clap::Parser;
use tracing::{info, error};
use serde_json::{Value};
use std::fs;
use stroem_common::{init_tracing};
use std::path::{PathBuf};
use std::sync::{Arc};
use stroem_common::log_collector::LogCollectorServer;
use stroem_common::workspace_client::WorkspaceClient;
use stroem_common::runner::Runner;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, required = true)]
    server: String,
    #[arg(long, required = true)]
    job_id: String,
    #[arg(long, conflicts_with = "action")]
    task: Option<String>,
    #[arg(long, conflicts_with = "task")]
    action: Option<String>,
    #[arg(long)]
    input: Option<String>,
    #[arg(long, required = true)]
    worker_id: String,
    #[arg(short, long, required = true)]
    token: String,
    #[arg(long, default_value = "/tmp/workspace")]
    workspace: String,
}



#[tokio::main]
async fn main() {
    let args = Args::parse();

    init_tracing(args.verbose);
    /*
    let log_level = if args.verbose { tracing::Level::TRACE } else { tracing::Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

     */

    let workspace_path = fs::canonicalize(args.workspace).unwrap();

    info!("Runner started for job_id: {}, worker_id: {}", args.job_id, args.worker_id);

    let input: Option<Value> = args.input.as_ref()
        .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
            error!("Failed to parse input: {}", e);
            std::process::exit(1);
        }));

    let mut workspace = WorkspaceClient::new(PathBuf::from(&workspace_path)).await;
    let revision = workspace.sync(&args.server).await.unwrap_or_else(|e| {
        error!("Failed to get workspace: {}", e);
        std::process::exit(1);
    });
    if let Err(e) = workspace.read_workflows() {
        error!("Failed to read workflows: {}", e);
        std::process::exit(1);
    };

    let log_collector = Arc::new(LogCollectorServer::new(
        args.server.clone(),
        args.job_id.clone(),
        args.worker_id.clone(),
        args.token.clone(),
        None,
        Some(10)
    ));

    let mut runner = Runner::new(Some(args.server), Some(args.job_id), Some(args.worker_id), args.task, args.action, input, workspace, Some(revision), log_collector);
    let success = runner.execute().await.unwrap_or_else(|e| {
        error!("Execution failed: {}", e);
        false
    });

    if !success {
        std::process::exit(1);
    }
}