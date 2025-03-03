// workflow-server/src/api.rs
use axum::{routing::{post, get}, Router, Json, response::IntoResponse, http::StatusCode, extract::State};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::{info, error};
use crate::Queue;
use common::{Job, LogEntry, JobResult};
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;
use std::fs::File;
use std::io::{Write, Cursor};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

use common::workspace::Workspace;

#[derive(Clone)]
pub struct Api {
    pub queue: Queue,
    pub workspace: Workspace,
}


impl Api {
    pub fn new(queue: Queue, workspace: Workspace) -> Self {
        Self { queue, workspace }
    }
}

pub async fn run(api: Api, addr: &str) {
    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/jobs/results", post(post_job_result))
        .route("/files/workspace.tar.gz", get(serve_workspace_tarball))
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
async fn post_job_result(
    State(_api): State<Api>,
    Json(result): Json<JobResult>,
) -> Result<(), (StatusCode, String)> {
    info!(
        "Received job result: worker_id={}, job_id={}, status={}, start={}, end={}{}",
        result.worker_id,
        result.job_id,
        if result.exit_success { "success" } else { "failed" },
        result.start_datetime,
        result.end_datetime,
        if result.task.is_some() || result.action.is_some() {
            format!(
                ", task={:?}, action={:?}, input={:?}, output={:?}",
                result.task, result.action, result.input, result.output
            )
        } else {
            String::new()
        }
    );
    for log in &result.logs {
        info!(
            "Log [{}]{}: {}",
            log.timestamp,
            if log.is_stderr { " (stderr)" } else { "" },
            log.message
        );
    }
    // TODO: Store result (e.g., file, database)
    Ok(())
}

#[axum::debug_handler]
async fn serve_workspace_tarball(
    State(mut api): State<Api>,
) -> Result<impl IntoResponse, (StatusCode, String)> {

    let gzipped = api.workspace.build_tarball()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to build tarball: {}", e)))?;

    let revision = api.workspace.get_revision()
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to calculate rev: {}", e)))?;

    let headers = [
        ("Content-Type", "application/gzip".to_string()),
        ("Content-Disposition", "attachment; filename=\"workspace.tar.gz\"".to_string()),
        ("X-Revision", revision.to_string()),
    ];

    Ok((
        StatusCode::OK,
        headers,
        gzipped,
    ))
}