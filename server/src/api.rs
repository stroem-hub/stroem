use std::collections::HashMap;
// workflow-server/src/api.rs
use axum::{
    extract::{Path, Query, State},
    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
    body::Body
};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::{info, error, debug};
use crate::Queue;
use stroem_common::{JobRequest, log_collector::LogEntry, JobResult};
use futures::StreamExt;
use tar::Builder;
use flate2::write::GzEncoder;
use flate2::Compression;
use globwalker::GlobWalkerBuilder;
use std::fs::File;
use std::io::{Write, Cursor, Read};
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use anyhow::{anyhow, Error};
use serde_json::{Value, json};
use crate::workspace_server::WorkspaceServer;
use crate::repository::{JobRepository, LogRepository};
use crate::error::{ApiError, AppError};
use std::sync::{Arc, RwLock};
use rust_embed::RustEmbed;
use mime_guess::from_path;
use stroem_common::workflows_configuration::Task;

#[derive(RustEmbed)]
#[folder = "static/"]
#[prefix = ""]
struct StaticAssets;


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
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/{:task_id}", get(get_task))
        .route("/api/jobs", get(get_jobs))
        .route("/api/jobs/{:job_id}", get(get_job))
        .route("/api/jobs/{:job_id}/logs", get(get_job_logs))
        .route("/api/jobs/{:job_id}/steps/{:step_name}/logs", get(get_job_step_logs))
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
        .route("/{*path}", get(serve_static))
        .route("/", get(serve_static))
        .with_state(api);

    let listener = TcpListener::bind(addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}

async fn serve_static(uri: Uri) -> impl IntoResponse {
    let path = uri.path();
    let path = path.trim_start_matches('/'); // Remove leading slash
    debug!("Serving static file at {}", path);
    match StaticAssets::get(path) {
        Some(file) => {
            let mime = from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime.as_ref())
                .body(Body::from(file.data))
                .unwrap()
        }
        None => {
            // Fallback to index.html for SPA routing
            match StaticAssets::get("index.html") {
                Some(file) => Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(file.data.into())
                    .unwrap(),
                None => Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body("404 Not Found".into())
                    .unwrap(),
            }
        }
    }
}

#[axum::debug_handler]
async fn get_tasks(
    State(api): State<Api>,
) -> Result<Json<Value>, ApiError> {
    let workflows_guard = api.workspace.workflows.read().map_err(|_| anyhow!("Could not read workspace"))?;
    let workflows = workflows_guard.as_ref().unwrap();
    let tasks = workflows.tasks.as_ref();

    let mut total = 0;

    let tasks_json = match &workflows.tasks {
        Some(tasks) => {
            let mut task_array: Vec<Value> = tasks.iter().map(|(name, task)| serde_json::to_value(task).unwrap()).collect();
            total = task_array.len();
            // task_array.sort_by(|a, b| a.get("name").unwrap().as_str().cmp(&b.get("name").unwrap().as_str()));
            serde_json::to_value(task_array)?
        }
        None => Value::Array(vec![]), // Empty array if no tasks
    };

    Ok(json!({
        "success": true,
        "data": tasks_json,
        "meta": {
            "total": total
        }
    }).into())
}

#[axum::debug_handler]
async fn get_task(
    State(api): State<Api>,
    Path(task_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let workflows_guard = api.workspace.workflows.read().map_err(|_| anyhow!("Could not read workspace"))?;
    let workflows = workflows_guard.as_ref().unwrap();
    let task = serde_json::to_value(workflows.get_task(task_id.as_str()))?;
    Ok(json!({
        "success": true,
        "data": task,
    }).into())
}

#[axum::debug_handler]
async fn get_jobs(
    State(api): State<Api>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, AppError> {
    let jobs = api.job_repository.get_jobs().await?;
    Ok(json!({
        "success": true,
        "data": serde_json::to_value(jobs)?,
        "meta": {
        }
    }).into())
}

#[axum::debug_handler]
async fn get_job(
    State(api): State<Api>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let task = api.job_repository.get_job(job_id.as_str()).await?;
    Ok(json!({
        "success": true,
        "data": task,
    }).into())
}

#[axum::debug_handler]
async fn get_job_logs(
    State(api): State<Api>,
    Path(job_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    let log_stream = api.log_repository.get_logs(job_id.as_str(), None).await?;
    let logs: Vec<LogEntry> = log_stream
        .collect::<Vec<Result<LogEntry, Error>>>()
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

    Ok(json!({
        "success": true,
        "data": logs,
    }).into())
}

#[axum::debug_handler]
async fn get_job_step_logs(
    State(api): State<Api>,
    Path((job_id, step_name)): Path<(String, String)>,
) -> Result<Json<Value>, ApiError> {
    let log_stream = api.log_repository.get_logs(job_id.as_str(), Some(step_name.as_str())).await?;
    let logs: Vec<LogEntry> = log_stream
        .collect::<Vec<Result<LogEntry, Error>>>()
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

    Ok(json!({
        "success": true,
        "data": logs,
    }).into())
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
    Json(job): Json<JobRequest>,
) -> Result<String, AppError> {
    Ok(api.job_repository.enqueue_job(&job, "user", None).await?)
}

#[axum::debug_handler]
async fn get_next_job(
    State(api): State<Api>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Option<JobRequest>>, AppError> {
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