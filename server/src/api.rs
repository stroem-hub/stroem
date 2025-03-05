use std::collections::HashMap;
// workflow-server/src/api.rs
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
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
use anyhow::{anyhow, Error};

use common::workspace::Workspace;
use crate::repository::JobRepository;
use crate::error::AppError;


#[derive(Clone)]
pub struct Api {
    pub queue: Queue,
    pub workspace: Workspace,
    pub job_repository: JobRepository,
}


impl Api {
    pub fn new(queue: Queue, workspace: Workspace, job_repository: JobRepository) -> Self {
        Self { queue, workspace, job_repository }
    }
}

pub async fn run(api: Api, addr: &str) {
    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/jobs/:job_id/start", post(update_job_start))
        .route("/jobs/:job_id/results", post(update_job_result))
        .route("/jobs/:job_id/steps/:step_name/start", post(update_step_start))
        .route("/jobs/:job_id/steps/:step_name/results", post(update_step_result))
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
) -> Result<String, AppError> {
    Ok(api.job_repository.enqueue_job(&job, "user", None).await?)
}

#[axum::debug_handler]
async fn get_next_job(
    State(api): State<Api>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Option<Job>>, AppError> {
    let worker_id = params.get("worker_id").unwrap();
    let job = api.job_repository.get_next_job(worker_id).await?;
    Ok(Json(job))
}

#[axum::debug_handler]
async fn update_job_start(
    State(api): State<Api>,
    Path(job_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    api.job_repository
        .update_start_time(&job_id, worker_id)
        .await?;
    Ok(())
}


#[axum::debug_handler]
async fn update_job_result(
    State(api): State<Api>,
    Path(job_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    Json(result): Json<JobResult>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    api.job_repository
        .update_job_result(&result)
        .await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_start(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    api.job_repository
        .update_step_start_time(&job_id, &step_name, &worker_id)
        .await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_result(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<serde_json::Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    let output = payload.get("output");
    let success = payload.get("success").unwrap().as_bool().unwrap();
    api.job_repository
        .update_step_result(&job_id, &step_name, &worker_id, output, success)
        .await?;
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