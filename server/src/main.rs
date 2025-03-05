use std::ops::DerefMut;
// workflow-server/src/main.rs
use clap::Parser;
use tracing::{info, error, Level};
use tracing_subscriber;
use tokio::signal;
use std::path::PathBuf;
use config::{Config, File, Environment};
use anyhow::{bail, Error};
use deadpool_postgres;
use tokio_postgres::NoTls;
use refinery::embed_migrations;

mod scheduler;
mod queue;
mod api;
mod repository;
mod error;

use common::Job;
use common::workspace::{Workspace, WorkspaceConfiguration, WorkspaceConfigurationTrait};
use scheduler::Scheduler;
use queue::Queue;
use repository::JobRepository;

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, default_value = ".")]
    workspace: String,
    #[arg(short, long, required = false)]
    config: Option<String>,
    #[arg(short, long)]
    verbose: bool,
}

embed_migrations!("migrations");

#[tokio::main]
async fn main() -> Result<(), Error>{
    let args = Args::parse();
    let log_level = if args.verbose { Level::TRACE } else { Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    let mut cfg_builder = Config::builder();
    if let Some(config_filename) = args.config {
        cfg_builder = cfg_builder.add_source(File::with_name(config_filename.as_str()));
    }
    cfg_builder = cfg_builder.add_source(Environment::with_prefix("WF").separator("_"));
    let cfg = cfg_builder.build()?;

    let mut db_config = deadpool_postgres::Config::new();
    db_config.host = Some(cfg.get_string("db.host")?.to_string());
    db_config.dbname = Some(cfg.get_string("db.database")?.to_string());
    db_config.user = Some(cfg.get_string("db.username")?.to_string());
    db_config.password = Some(cfg.get_string("db.password")?.to_string());
    db_config.manager = Some(deadpool_postgres::ManagerConfig {
        recycling_method: deadpool_postgres::RecyclingMethod::Fast,
    });

    let db_pool= db_config.create_pool(Some(deadpool_postgres::Runtime::Tokio1), NoTls)?;

    let mut db_client = db_pool.get().await?;
    migrations::runner()
        .run_async(db_client.deref_mut().deref_mut()) // Get to the tokio_postgresql object
        .await?;

    let workspace_dir = PathBuf::from(&args.workspace);
    if !workspace_dir.exists() || !workspace_dir.is_dir() {
        bail!("Workspace path '{}' does not exist or is not a directory", args.workspace);
        // return Ok(());
    }

    let workspace = Workspace::new(workspace_dir);
    let job_repo = JobRepository::new(db_pool);

    // Create Queue
    let queue = Queue::new(100);

    // Create Scheduler
    let mut scheduler = Scheduler::new(queue.clone(), workspace.config.as_ref().unwrap());
    scheduler.run().await;

    // Create Api
    let server = api::Api::new(queue.clone(), workspace, job_repo);
    tokio::spawn(async move {
        api::run(server, "0.0.0.0:8080").await;
    });

    // Empty loop with graceful shutdown
    info!("Server running, waiting for shutdown signal...");
    signal::ctrl_c().await.expect("Failed to listen for shutdown signal");
    info!("Received shutdown signal, shutting down gracefully...");
    scheduler.stop().await;
    Ok(())
}