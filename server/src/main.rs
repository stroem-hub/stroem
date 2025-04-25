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
use sqlx::postgres::PgPoolOptions;
use sqlx::migrate::Migrator;


mod scheduler;
mod repository;
mod error;
mod server_config;
pub mod workspace_server;
mod workspace_source;
mod web;
mod auth;

use stroem_common::JobRequest;
use stroem_common::workflows_configuration::WorkflowsConfiguration;
use workspace_server::WorkspaceServer;
use scheduler::Scheduler;
use repository::JobRepository;
use crate::repository::LogRepositoryFactory;
use std::sync::{Arc, RwLock};
use tracing_subscriber::util::SubscriberInitExt;
use crate::auth::{AuthService};

#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    #[arg(short, long, required = true)]
    config: String,
    #[arg(short, long)]
    verbose: bool,
}

// embed_migrations!("migrations");
static MIGRATOR: Migrator = sqlx::migrate!();

#[tokio::main]
async fn main() -> Result<(), Error>{
    let args = Args::parse();
    let log_level = if args.verbose { Level::TRACE } else { Level::INFO };
    tracing_subscriber::fmt()
        .with_max_level(log_level)
        .init();

    let cfg = server_config::ServerConfig::new(PathBuf::from(args.config))?;

    let db_pool = PgPoolOptions::new()
        .max_connections(5) // Adjust as needed, default max connections
        .connect(&format!(
            "postgres://{}:{}@{}/{}",
            cfg.db.username, cfg.db.password, cfg.db.host, cfg.db.database
        ))
        .await?;

    MIGRATOR.run(&db_pool).await?;

    // let mut db_client = db_pool.get().await.context("Could not connect to DB server")?;
    // migrations::runner()
    //     .run_async(db_client.deref_mut().deref_mut()) // Get to the tokio_postgresql object
    //     .await?;

    let workspace_dir = &cfg.workspace.folder;
    create_dir_all(workspace_dir)?;

    let workspace = Arc::new(WorkspaceServer::new(cfg.workspace).await);
    let revision = workspace.sync().await?;
    info!("Workspace sync complete, revision: {}", revision.unwrap_or("unknown".to_string()));
    workspace.read_workflows()?;
    workspace.clone().watch().await;


    let job_repo = JobRepository::new(db_pool.clone());
    let logs_repo = LogRepositoryFactory::new(&cfg.log_storage).await?;
    let auth_service = AuthService::new(cfg.auth.clone(), db_pool.clone(), cfg.public_url.clone()).await;
    auth_service.add_initial_user().await?;

    // Create Scheduler
    let mut scheduler = Scheduler::new(job_repo.clone(), workspace.subscribe());
    scheduler.run().await;

    // Create Api
    let state = web::WebState::new(workspace, job_repo, logs_repo, auth_service, cfg.public_url.clone());
    tokio::spawn(async move {
        web::run(state, "0.0.0.0:8080").await;
    });

    // Empty loop with graceful shutdown
    info!("Server running, waiting for shutdown signal...");
    signal::ctrl_c().await.expect("Failed to listen for shutdown signal");
    info!("Received shutdown signal, shutting down gracefully...");
    scheduler.stop().await;
    Ok(())
}