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
use tracing::{info, error, debug};
use crate::Queue;
use stroem_common::{Job, log_collector::LogEntry, JobResult};
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;
use std::fs::File;
use std::io::{Write, Cursor};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use anyhow::{anyhow, Error};
use serde_json::Value;
use crate::workspace_server::WorkspaceServer;
use crate::repository::{JobRepository, LogRepository};
use crate::error::AppError;
use std::sync::{Arc, RwLock};


#[derive(Clone)]
pub struct Api {
    pub workspace: Arc<WorkspaceServer>,
    pub job_repository: JobRepository,
    pub log_repository: LogRepository,
}


impl Api {
    pub fn new(workspace: Arc<WorkspaceServer>, job_repository: JobRepository, log_repository: LogRepository) -> Self {
        Self { workspace, job_repository, log_repository }
    }
}

pub async fn run(api: Api, addr: &str) {
    let app = Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/jobs/{:job_id}/start", post(update_job_start))
        .route("/jobs/{:job_id}/logs", post(save_job_logs))
        .route("/jobs/{:job_id}/results", post(update_job_result))
        .route("/jobs/{:job_id}/steps/{:step_name}/start", post(update_step_start))
        .route("/jobs/{:job_id}/steps/{:step_name}/logs", post(save_step_logs))
        .route("/jobs/{:job_id}/steps/{:step_name}/results", post(update_step_result))
        .route("/files/workspace.tar.gz", get(serve_workspace_tarball))
        .route("/reload", post(reload_workspace))
        .with_state(api);

    let listener = TcpListener::bind(addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

#[axum::debug_handler]
async fn reload_workspace(
    State(mut api): State<Api>,
) -> Result<Json<String>, AppError> {
    api.workspace.read_workflows()?;
    info!("Workspace reloaded and config broadcasted");
    Ok(Json("Reloaded".to_string()))
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
    Json(payload): Json<Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();

    let start_datetime_str = payload.get("start_datetime").and_then(|v| v.as_str()).unwrap();
    let start_datetime = DateTime::parse_from_rfc3339(start_datetime_str).map(|dt| dt.with_timezone(&Utc))?;

    let input = payload.get("input").cloned();
    api.job_repository
        .update_start_time(&job_id, worker_id, start_datetime, input)
        .await?;
    Ok(())
}


#[axum::debug_handler]
async fn update_job_result(
    State(api): State<Api>,
    Path(job_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<JobResult>,
) -> Result<(), AppError> {
    debug!("Payload: {:?}", payload);
    let worker_id = params.get("worker_id").unwrap();
    let output = payload.output.as_ref();
    debug!("Worker id: {}", worker_id);
    debug!("Output: {:?}", output);
    api.job_repository
        .update_job_result(&job_id, &payload)
        .await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_start(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    let start_datetime_str = payload.get("start_datetime").and_then(|v| v.as_str()).unwrap();
    let start_datetime = DateTime::parse_from_rfc3339(start_datetime_str).map(|dt| dt.with_timezone(&Utc))?;

    let input = payload.get("input").cloned();

    api.job_repository
        .update_step_start_time(&job_id, &step_name, &worker_id, start_datetime, input)
        .await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_result(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<JobResult>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    debug!("Payload: {:?}", payload);
    api.job_repository
        .update_step_result(&job_id, &step_name, &payload)
        .await?;
    Ok(())
}

#[axum::debug_handler]
async fn save_job_logs(
    State(api): State<Api>,
    Path(job_id): Path<String>,
    Json(logs): Json<Vec<LogEntry>>,
) -> Result<(), AppError> {
    api.log_repository.save_logs(&job_id, None, logs).await?;
    Ok(())
}

#[axum::debug_handler]
async fn save_step_logs(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
    Json(logs): Json<Vec<LogEntry>>,
) -> Result<(), AppError> {
    api.log_repository.save_logs(&job_id, Some(&step_name), logs).await?;
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