use std::collections::HashMap;
use axum::{
    extract::{
        ws::{WebSocket, WebSocketUpgrade},
        Path, Query, State
    },

    http::{StatusCode, Uri},
    response::{IntoResponse, Response},
    response::sse::{Event, Sse},
    routing::{get, post},
    Json, Router,
    body::Body
};
use std::path::PathBuf;
use tokio::net::TcpListener;
use tracing::{info, error, debug};
use stroem_common::{JobRequest, log_collector::LogEntry, JobResult};
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
use crate::error::AppError;
use std::sync::{Arc, RwLock, Mutex};
use rust_embed::RustEmbed;
use mime_guess::from_path;
use stroem_common::workflows_configuration::Task;
use tokio::sync::broadcast::{self, Sender};
use futures_util::stream::Stream;
use std::convert::Infallible;
use tokio_stream::wrappers::BroadcastStream;
use tokio_stream::StreamExt;
use std::{pin::Pin, task::{Context, Poll}};
use crate::web::WebState;

pub fn get_routes() -> Router<WebState> {
    Router::new()
        .route("/jobs", post(enqueue_job))
        .route("/jobs/next", get(get_next_job))
        .route("/jobs/{:job_id}/start", post(update_job_start))
        .route("/jobs/{:job_id}/logs", post(save_job_logs))
        .route("/jobs/{:job_id}/results", post(update_job_result))
        .route("/jobs/{:job_id}/steps/{:step_name}/start", post(update_step_start))
        .route("/jobs/{:job_id}/steps/{:step_name}/logs", post(save_step_logs))
        .route("/jobs/{:job_id}/steps/{:step_name}/results", post(update_step_result))
        .route("/files/workspace.tar.gz", get(serve_workspace_tarball))
}

#[axum::debug_handler]
async fn enqueue_job(
    State(api): State<WebState>,
    Json(job): Json<JobRequest>,
) -> Result<String, AppError> {
    Ok(api.job_repository.enqueue_job(&job, "user", None).await?)
}

#[axum::debug_handler]
async fn get_next_job(
    State(api): State<WebState>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Option<JobRequest>>, AppError> {
    let worker_id = params.get("worker_id").unwrap();
    let job = api.job_repository.get_next_job(worker_id).await?;
    Ok(Json(job))
}

#[axum::debug_handler]
async fn update_job_start(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();

    let start_datetime_str = payload.get("start_datetime").and_then(|v| v.as_str()).unwrap();
    let start_datetime = DateTime::parse_from_rfc3339(start_datetime_str).map(|dt| dt.with_timezone(&Utc))?;

    let input = payload.get("input").cloned();
    api.job_repository
        .update_start_time(&job_id, worker_id, start_datetime, &input)
        .await?;

    crate::web::api::send_sse_event(&api, &job_id, "start", json!({
        "start_datetime": &start_datetime,
        "input": &input,
    })).await?;

    Ok(())
}


#[axum::debug_handler]
async fn update_job_result(
    State(api): State<WebState>,
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

    api.log_repository
        .job_done(&job_id)
        .await?;

    crate::web::api::send_sse_event(&api, &job_id, "result", json!({
        "result": &payload
    })).await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_start(
    State(api): State<WebState>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<Value>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    let start_datetime_str = payload.get("start_datetime").and_then(|v| v.as_str()).unwrap();
    let start_datetime = DateTime::parse_from_rfc3339(start_datetime_str).map(|dt| dt.with_timezone(&Utc))?;

    let input = payload.get("input").cloned();

    api.job_repository
        .update_step_start_time(&job_id, &step_name, &worker_id, start_datetime, &input)
        .await?;

    crate::web::api::send_sse_event(&api, &job_id, "step_start", json!({
        "step_name": &step_name,
        "start_datetime": &start_datetime,
        "input": &input,
    })).await?;
    Ok(())
}

#[axum::debug_handler]
async fn update_step_result(
    State(api): State<WebState>,
    Path((job_id, step_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
    Json(payload): Json<JobResult>,
) -> Result<(), AppError> {
    let worker_id = params.get("worker_id").unwrap();
    debug!("Payload: {:?}", payload);
    api.job_repository
        .update_step_result(&job_id, &step_name, &payload)
        .await?;

    crate::web::api::send_sse_event(&api, &job_id, "step_result", json!({
        "step_name": &step_name,
        "result": &payload
    })).await?;

    Ok(())
}

#[axum::debug_handler]
async fn save_job_logs(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
    Json(logs): Json<Vec<LogEntry>>,
) -> Result<(), AppError> {
    api.log_repository.save_logs(&job_id, None, &logs).await?;

    crate::web::api::send_sse_event(&api, &job_id, "logs", json!({
        "logs": &logs
    })).await?;

    Ok(())
}

#[axum::debug_handler]
async fn save_step_logs(
    State(api): State<WebState>,
    Path((job_id, step_name)): Path<(String, String)>,
    Json(logs): Json<Vec<LogEntry>>,
) -> Result<(), AppError> {
    api.log_repository.save_logs(&job_id, Some(&step_name), &logs).await?;

    crate::web::api::send_sse_event(&api, &job_id, "step_logs", json!({
        "step_name": &step_name,
        "logs": &logs
    })).await?;

    Ok(())
}


#[axum::debug_handler]
async fn serve_workspace_tarball(
    State(mut api): State<WebState>,
) -> Result<impl IntoResponse, AppError> {

    let gzipped = api.workspace.build_tarball().await?;

    let revision = api.workspace.get_revision().unwrap_or("unknown".to_string());
    debug!("Revision: {}", revision);

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