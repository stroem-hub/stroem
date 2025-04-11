use std::collections::HashMap;
// workflow-server/src/api.rs
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
use crate::error::{ApiError, AppError};
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
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/{:task_id}", get(get_task))
        .route("/api/jobs", get(get_jobs))
        .route("/api/jobs/{:job_id}", get(get_job))
        .route("/api/jobs/{:job_id}/logs", get(get_job_logs))
        .route("/api/jobs/{:job_id}/steps/{:step_name}/logs", get(get_job_step_logs))
        .route("/api/jobs/{:job_id}/sse", get(get_job_sse))
        .route("/api/run", post(put_job))
}


#[derive(Clone)]
pub struct JobEvent {
    pub event_name: String,
    pub data: Value,
}

struct JobChannel<S> {
    inner: Pin<Box<S>>,
    job_id: String,
    channels: Arc<Mutex<HashMap<String, Sender<JobEvent>>>>,
}

impl<S> Stream for JobChannel<S>
where
    S: Stream<Item = Result<Event, Infallible>> + 'static,
{
    type Item = Result<Event, Infallible>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        self.inner.as_mut().poll_next(cx)
    }
}

impl<S> Drop for JobChannel<S> {
    fn drop(&mut self) {
        let mut channels = self.channels.lock().unwrap();
        if let Some(tx) = channels.get(&self.job_id) {
            if tx.receiver_count() <= 1 {
                // current one is about to drop, so it's the last
                channels.remove(&self.job_id);
                debug!("Removed channel for job_id: {}", self.job_id);
            }
        }
    }
}


#[axum::debug_handler]
async fn get_tasks(
    State(api): State<WebState>,
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
    State(api): State<WebState>,
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
    State(api): State<WebState>,
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
    State(api): State<WebState>,
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
    State(api): State<WebState>,
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
    State(api): State<WebState>,
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
async fn put_job(
    State(api): State<WebState>,
    Json(job): Json<JobRequest>,
) -> Result<Json<Value>, ApiError> {
    let job_id = api.job_repository.enqueue_job(&job, "user", None).await?;
    Ok(json!({
        "success": true,
        "data": &job_id,
    }).into())
}

#[axum::debug_handler]
async fn get_job_sse(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {

    debug!("Received SSE connection for job {}", job_id);


    let mut rx = {
        let mut channels = api.job_channels.lock().unwrap();
        if let Some(tx) = channels.get(&job_id) {
            tx.subscribe()
        } else {
            let (tx, rx) = broadcast::channel(100);
            channels.insert(job_id.clone(), tx);
            rx
        }
    };

    let stream = BroadcastStream::new(rx).then(|result| async move {
        match result {
            Ok(msg) => {
                // Perform async operations here if needed (e.g., async serialization in the future)
                let data = serde_json::to_string(&msg.data).unwrap(); // Currently sync, but could be async
                Ok(Event::default().event(msg.event_name).data(data))
            }
            Err(e) => {
                error!("BroadcastStream error: {:?}", e); // Log for debugging
                // Instead of dropping, you could return an error event or retry logic here
                Ok(Event::default().data(format!("Error: {:?}", e))) // Example: Send error as an event
            }
        }
    });

    let pinned = Box::pin(stream);

    let wrapped_stream = JobChannel {
        inner: pinned,
        job_id: job_id.clone(),
        channels: Arc::clone(&api.job_channels),
    };

    Sse::new(wrapped_stream).keep_alive(axum::response::sse::KeepAlive::default())
}

pub async fn send_sse_event(api: &WebState, job_id: &str, name: &str, data: Value) -> Result<(), Error> {
    let channels = api.job_channels.lock().map_err(|_| anyhow!("Could not lock job channels"))?;
    if let Some(mut tx) = channels.get(job_id) {
        let event = JobEvent {
            event_name: name.to_string(),
            data
        };
        let _ = tx.send(event);
    }
    Ok(())
}
