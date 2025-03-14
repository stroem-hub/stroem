use stroem_common::workspace_client::WorkspaceClient;
use serde_json::Value;
use tracing::error;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use stroem_common::init_tracing;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[command(subcommand)]
    command: Commands,
    #[arg(short, long)]
    verbose: bool,
    #[arg(long, default_value = ".")]
    workspace: String,
}

#[derive(Debug, Subcommand)]
enum Commands {
    Validate {},
    Run {
        #[arg(long, conflicts_with = "action")]
        task: Option<String>,
        #[arg(long, conflicts_with = "task")]
        action: Option<String>,
        #[arg(long)]
        input: Option<String>,
    }
}

#[tokio::main]
async fn main() {
    let args = Args::parse();
    // init_tracing(args.verbose);

    let mut workspace = WorkspaceClient::new(PathBuf::from(&args.workspace)).await;

    if let Err(e) = workspace.read_workflows() {
        eprintln!("Failed to read workflows: {}", e);
        std::process::exit(1);
    };


    match args.command {
        Commands::Validate {} => {
        }
        Commands::Run { task, action, input } => {
            let input: Option<Value> = input.as_ref()
                .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
                    error!("Failed to parse input: {}", e);
                    std::process::exit(1);
                }));
        }
    }


}