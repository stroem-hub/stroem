// server/src/main.rs
use axum::{routing::{post, get}, Router, Json, response::IntoResponse, http::StatusCode};
use serde::{Deserialize, Serialize};
use std::fs::File;
use std::io::{Write, Cursor};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tokio::sync::mpsc::{self, Sender, Receiver};
use tracing::{info, error, Level, debug};
use tracing_subscriber;
use clap::Parser;
use std::sync::{Arc, Mutex};
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;

mod workspace;
mod scheduler;
use workspace::WorkspaceConfigurationTrait;
use scheduler::scheduler;

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Job {
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

    let addr = "0.0.0.0:8080";
    let (tx, rx) = mpsc::channel::<Job>(100);
    let rx = Arc::new(Mutex::new(rx));
    let tx_for_scheduler = tx.clone();

    tokio::spawn(async move {
        scheduler(tx_for_scheduler, workspace_config).await;
    });

    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/files/workflows.tar.gz", get(serve_workspace_tarball))
        .with_state((tx, rx, workspace.clone()));

    let listener = TcpListener::bind(&addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

async fn enqueue_job(
    axum::extract::State((tx, _, _)): axum::extract::State<(Sender<Job>, Arc<Mutex<Receiver<Job>>>, PathBuf)>,
    Json(job): Json<Job>,
) -> Result<String, String> {
    info!("Received job: {:?}", job);
    tx.send(job).await.map_err(|e| e.to_string())?;
    Ok("Job enqueued".to_string())
}

async fn get_next_job(
    axum::extract::State((_, rx, _)): axum::extract::State<(Sender<Job>, Arc<Mutex<Receiver<Job>>>, PathBuf)>,
) -> Result<Json<Option<Job>>, (StatusCode, String)> {
    let mut rx = rx.lock().unwrap();
    match rx.try_recv() {
        Ok(job) => {
            info!("Dequeued job: {:?}", job);
            Ok(Json(Some(job)))
        }
        Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
            debug!("No jobs in queue");
            Ok(Json(None))
        }
        Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
            error!("Queue sender disconnected");
            Err((StatusCode::INTERNAL_SERVER_ERROR, "Queue sender disconnected".to_string()))
        }
    }
}

async fn serve_workspace_tarball(
    axum::extract::State((_, _, workspace)): axum::extract::State<(Sender<Job>, Arc<Mutex<Receiver<Job>>>, PathBuf)>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut tarball = Vec::new();
    let mut builder = Builder::new(&mut tarball);

    let walker = GlobWalkerBuilder::from_patterns(&workspace, &["**/*"])
        .max_depth(10)
        .follow_links(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build walker: {}", e)))?;

    for entry in walker.into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            let relative_path = path.strip_prefix(&workspace)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to get relative path: {}", e)))?;
            let mut file = File::open(path)
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to open file: {}", e)))?;
            builder.append_file(
                relative_path,
                &mut file,
            )
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to append file to tar: {}", e)))?;
        }
    }

    builder.finish()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to finish tar: {}", e)))?;
    drop(builder);

    let mut gzipped = Vec::new();
    let mut encoder = GzEncoder::new(&mut gzipped, Compression::default());
    encoder.write_all(&tarball)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to write to gzip: {}", e)))?;
    encoder.finish()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to finish gzip: {}", e)))?;

    Ok((
        StatusCode::OK,
        [
            ("Content-Type", "application/gzip"),
            ("Content-Disposition", "attachment; filename=\"workspace.tar.gz\""),
        ],
        gzipped,
    ))
}