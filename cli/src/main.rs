use std::sync::Arc;
use stroem_common::workspace_client::WorkspaceClient;
use serde_json::Value;
use tracing::error;
use clap::{Parser, Subcommand};
use std::path::PathBuf;
use stroem_common::log_collector::LogCollectorConsole;
use stroem_common::runner::Runner;
use std::fs;

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

    let workspace_path = fs::canonicalize(args.workspace).unwrap();

    let mut workspace = WorkspaceClient::new(PathBuf::from(&workspace_path)).await;

    if let Err(e) = workspace.read_workflows() {
        eprintln!("Failed to read workflows: {}", e);
        std::process::exit(1);
    };


    match args.command {
        Commands::Validate {} => {
            if let Some(workflows) = workspace.workflows {
                if let Err(e) = workflows.validate() {
                    eprintln!("Failed to validate workflows: {}", e);
                    std::process::exit(1);
                }
            }
            else {
                eprintln!("Cuuld not load workflows");
                std::process::exit(1);
            }
            println!("Workspace configuration is valid");
        }
        Commands::Run { task, action, input } => {
            let input: Option<Value> = input.as_ref()
                .map(|s| serde_json::from_str(s).unwrap_or_else(|e| {
                    error!("Failed to parse input: {}", e);
                    std::process::exit(1);
                }));


            let log_collector = Arc::new(LogCollectorConsole::new(None));

            let mut runner = Runner::new(None, None, None,
                                         task, action, input,
                                         workspace, None,
                                         log_collector);

            let success = runner.execute().await.unwrap_or_else(|e| {
                eprintln!("Execution failed: {}", e);
                false
            });

            if !success {
                std::process::exit(1);
            }

            println!("Successfully executed");
        }
    }


}