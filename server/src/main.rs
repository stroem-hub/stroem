use std::fs::create_dir_all;
use std::ops::DerefMut;
// workflow-server/src/main.rs
use clap::Parser;
use tracing::{error, info, Level};
use tracing_subscriber;
use tokio::signal;
use std::path::PathBuf;
use config::{Config, Environment, File};
use anyhow::{bail, Context, Error};
use deadpool_postgres;
use tokio_postgres::NoTls;
use refinery::embed_migrations;

mod scheduler;
mod queue;
mod api;
mod repository;
mod error;
mod server_config;
pub mod workspace_server;
mod workspace_git;
mod workspace_folder;

use stroem_common::Job;
use stroem_common::workflows_configuration::WorkflowsConfiguration;
use workspace_server::WorkspaceServer;
use scheduler::Scheduler;
use queue::Queue;
use repository::JobRepository;
use crate::repository::LogRepository;
use std::sync::{Arc, RwLock};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, required = true)]
    config: String,
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

    let cfg = server_config::ServerConfig::new(PathBuf::from(args.config))?;

    let mut db_config = deadpool_postgres::Config::new();
    db_config.host = Some(cfg.db.host);
    db_config.dbname = Some(cfg.db.database);
    db_config.user = Some(cfg.db.username);
    db_config.password = Some(cfg.db.password);
    db_config.manager = Some(deadpool_postgres::ManagerConfig {
        recycling_method: deadpool_postgres::RecyclingMethod::Fast,
    });

    let db_pool= db_config.create_pool(Some(deadpool_postgres::Runtime::Tokio1), NoTls)?;

    let mut db_client = db_pool.get().await.context("Could not connect to DB server")?;
    migrations::runner()
        .run_async(db_client.deref_mut().deref_mut()) // Get to the tokio_postgresql object
        .await?;

    let workspace_dir = cfg.workspace.folder;
    create_dir_all(&workspace_dir)?;

    let workspace = Arc::new(WorkspaceServer::new(workspace_dir, cfg.workspace.git).await);
    workspace.read_workflows()?;
    workspace.clone().watch().await;


    let job_repo = JobRepository::new(db_pool);
    let logs_repo = LogRepository::new(cfg.logs.folder);

    // Create Scheduler
    let mut scheduler = Scheduler::new(job_repo.clone(), workspace.subscribe());
    scheduler.run().await;

    // Create Api
    let server = api::Api::new(workspace, job_repo, logs_repo);
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