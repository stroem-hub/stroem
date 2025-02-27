// workflow-server/src/api.rs
use axum::{routing::{post, get}, Router, Json, response::IntoResponse, http::StatusCode, extract::State};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::{info, error};
use crate::Queue;
use common::Job;
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;
use std::fs::File;
use std::io::{Write, Cursor};

#[derive(Clone)]
pub struct Api {
    pub queue: Queue,
    pub workspace: PathBuf,
}

impl Api {
    pub fn new(queue: Queue, workspace: PathBuf) -> Self {
        Self { queue, workspace }
    }
}

pub async fn run(api: Api, addr: &str) {
    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/files/workflows.tar.gz", get(serve_workspace_tarball))
        .with_state(api);

    let listener = TcpListener::bind(addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

#[axum::debug_handler]
async fn enqueue_job(
    State(api): State<Api>,
    Json(job): Json<Job>,
) -> Result<String, String> {
    api.queue.enqueue(job).await
}

#[axum::debug_handler]
async fn get_next_job(
    State(api): State<Api>,
) -> Result<Json<Option<Job>>, (StatusCode, String)> {
    match api.queue.dequeue() {
        Ok(job) => Ok(Json(job)),
        Err(e) => Err((StatusCode::INTERNAL_SERVER_ERROR, e)),
    }
}

#[axum::debug_handler]
async fn serve_workspace_tarball(
    State(api): State<Api>,
) -> Result<impl IntoResponse, (StatusCode, String)> {
    let mut tarball = Vec::new();
    let mut builder = Builder::new(&mut tarball);

    let walker = GlobWalkerBuilder::from_patterns(&api.workspace, &["**/*"])
        .max_depth(10)
        .follow_links(true)
        .build()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build walker: {}", e)))?;

    for entry in walker.into_iter().filter_map(Result::ok) {
        let path = entry.path();
        if path.is_file() {
            let relative_path = path.strip_prefix(&api.workspace)
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