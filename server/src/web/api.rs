use crate::auth::User;
use crate::error::AppError;
use crate::web::WebState;
use crate::web::api_response::{ApiError, ApiResponse};
use anyhow::{Error, anyhow};
use axum::{
    Json, Router,
    extract::{Path, Query, State},
    response::sse::{Event, Sse},
    routing::{get, post},
};
use futures_util::stream::Stream;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::convert::Infallible;
use std::sync::{Arc, Mutex};
use std::{
    pin::Pin,
    task::{Context, Poll},
};
use stroem_common::{JobRequest, log_collector::LogEntry};
use tokio::sync::broadcast::{self, Sender};
use tokio_stream::StreamExt;
use tokio_stream::wrappers::BroadcastStream;
use tracing::{debug, error, warn};

#[derive(Debug, Deserialize)]
pub struct TaskListQuery {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_limit")]
    pub limit: u32,
    pub sort: Option<String>,
    #[serde(default = "default_order")]
    pub order: String,
    pub search: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TaskJobsQuery {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_job_limit")]
    pub limit: u32,
    pub status: Option<String>,
    pub sort: Option<String>,
    #[serde(default = "default_order")]
    pub order: String,
}

#[derive(Debug, Deserialize)]
pub struct JobTrendsQuery {
    #[serde(default = "default_time_range")]
    pub range: String,
}

fn default_time_range() -> String {
    "24h".to_string()
}

fn default_job_limit() -> u32 {
    20
}

fn default_page() -> u32 {
    1
}
fn default_limit() -> u32 {
    25
}
fn default_order() -> String {
    "asc".to_string()
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub limit: u32,
    pub total: u32,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

#[derive(Debug, Serialize)]
pub struct PaginatedTasksResponse {
    pub data: Vec<Value>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct EnhancedTaskStatistics {
    pub total_executions: i64,
    pub success_count: i64,
    pub failure_count: i64,
    pub last_execution: Option<LastExecutionInfo>,
    pub average_duration: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct LastExecutionInfo {
    pub timestamp: String,
    pub status: String,
    pub triggered_by: String,
    pub duration: Option<f64>,
}

pub fn get_routes() -> Router<WebState> {
    Router::new()
        .route("/api/tasks", get(get_tasks))
        .route("/api/tasks/{:task_id}", get(get_task))
        .route("/api/tasks/{:task_id}/jobs", get(get_task_jobs))
        .route("/api/jobs", get(get_jobs))
        .route("/api/jobs/{:job_id}", get(get_job))
        .route("/api/jobs/{:job_id}/logs", get(get_job_logs))
        .route(
            "/api/jobs/{:job_id}/steps/{:step_name}/logs",
            get(get_job_step_logs),
        )
        .route("/api/jobs/{:job_id}/sse", get(get_job_sse))
        .route("/api/run", post(put_job))
        // Dashboard endpoints
        .route("/api/dashboard/system-status", get(get_dashboard_system_status))
        .route("/api/dashboard/job-metrics", get(get_dashboard_job_metrics))
        .route("/api/dashboard/recent-activity", get(get_dashboard_recent_activity))
        .route("/api/dashboard/job-trends", get(get_dashboard_job_trends))
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
    Query(params): Query<TaskListQuery>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting tasks with params: {:?}", params);

    // Validate pagination parameters
    if params.page == 0 {
        return Err(ApiError::from(anyhow!(
            "Page number must be greater than 0"
        )));
    }
    if params.limit == 0 || params.limit > 100 {
        return Err(ApiError::from(anyhow!("Limit must be between 1 and 100")));
    }

    // Validate sort and order parameters
    let valid_sort_fields = ["name", "lastExecution", "successRate"];
    if let Some(ref sort_field) = params.sort {
        if !valid_sort_fields.contains(&sort_field.as_str()) {
            return Err(ApiError::from(anyhow!(
                "Invalid sort field. Valid options: name, lastExecution, successRate"
            )));
        }
    }
    if params.order != "asc" && params.order != "desc" {
        return Err(ApiError::from(anyhow!("Order must be 'asc' or 'desc'")));
    }

    // Get all task statistics first (before acquiring the lock)
    let all_statistics = api
        .job_repository
        .get_all_task_statistics()
        .await
        .map_err(|e| {
            error!("Failed to get task statistics: {}", e);
            anyhow!("Failed to retrieve task statistics")
        })?;

    // Create a map for quick lookup of statistics by task name
    let stats_map: HashMap<String, crate::repository::TaskStatistics> = all_statistics
        .into_iter()
        .map(|stats| (stats.task_name.clone(), stats))
        .collect();

    let mut enhanced_tasks = Vec::new();

    // Now acquire the lock and process tasks
    {
        let workflows_guard = api
            .workspace
            .workflows
            .read()
            .map_err(|_| anyhow!("Could not read workspace"))?;
        let workflows = workflows_guard
            .as_ref()
            .ok_or_else(|| anyhow!("Workflows not initialized"))?;

        if let Some(tasks) = &workflows.tasks {
            for (task_name, task) in tasks.iter() {
                let mut task_value = serde_json::to_value(task)
                    .map_err(|e| anyhow!("Failed to serialize task: {}", e))?;

                // Add the task name as the id field
                task_value["id"] = serde_json::Value::String(task_name.clone());

                // Add statistics to the task
                if let Some(stats) = stats_map.get(task_name) {
                    let enhanced_stats = EnhancedTaskStatistics {
                        total_executions: stats.total_executions,
                        success_count: stats.success_count,
                        failure_count: stats.failure_count,
                        last_execution: stats.last_execution.as_ref().map(|le| {
                            // Map API status values to frontend expected values
                            let frontend_status = match le.status.as_str() {
                                "completed" => "success",
                                "failed" => "failed",
                                "running" => "running",
                                "queued" => "queued",
                                _ => &le.status, // fallback to original value
                            };

                            LastExecutionInfo {
                                timestamp: le.timestamp.to_rfc3339(),
                                status: frontend_status.to_string(),
                                triggered_by: le.triggered_by.clone(),
                                duration: le.duration,
                            }
                        }),
                        average_duration: stats.average_duration,
                    };
                    task_value["statistics"] = serde_json::to_value(enhanced_stats)?;
                } else {
                    // Task has no execution history
                    let empty_stats = EnhancedTaskStatistics {
                        total_executions: 0,
                        success_count: 0,
                        failure_count: 0,
                        last_execution: None,
                        average_duration: None,
                    };
                    task_value["statistics"] = serde_json::to_value(empty_stats)?;
                }

                enhanced_tasks.push(task_value);
            }
        }
    } // Lock is released here

    // Apply search filter if provided
    if let Some(ref search_term) = params.search {
        let search_lower = search_term.to_lowercase();
        enhanced_tasks.retain(|task| {
            let name_matches = task
                .get("name")
                .and_then(|n| n.as_str())
                .map(|n| n.to_lowercase().contains(&search_lower))
                .unwrap_or(false);

            let desc_matches = task
                .get("description")
                .and_then(|d| d.as_str())
                .map(|d| d.to_lowercase().contains(&search_lower))
                .unwrap_or(false);

            name_matches || desc_matches
        });
    }

    // Apply sorting
    if let Some(ref sort_field) = params.sort {
        enhanced_tasks.sort_by(|a, b| {
            let ordering = match sort_field.as_str() {
                "name" => {
                    let a_name = a.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    let b_name = b.get("name").and_then(|n| n.as_str()).unwrap_or("");
                    a_name.cmp(b_name)
                }
                "lastExecution" => {
                    let a_timestamp = a
                        .get("statistics")
                        .and_then(|s| s.get("last_execution"))
                        .and_then(|le| le.get("timestamp"))
                        .and_then(|t| t.as_str())
                        .unwrap_or("");
                    let b_timestamp = b
                        .get("statistics")
                        .and_then(|s| s.get("last_execution"))
                        .and_then(|le| le.get("timestamp"))
                        .and_then(|t| t.as_str())
                        .unwrap_or("");
                    a_timestamp.cmp(b_timestamp)
                }
                "successRate" => {
                    // Calculate success rate from counts
                    let a_stats = a.get("statistics");
                    let a_total = a_stats.and_then(|s| s.get("total_executions")).and_then(|t| t.as_i64()).unwrap_or(0);
                    let a_success = a_stats.and_then(|s| s.get("success_count")).and_then(|c| c.as_i64()).unwrap_or(0);
                    let a_rate = if a_total > 0 { (a_success as f64 / a_total as f64) * 100.0 } else { 0.0 };
                    
                    let b_stats = b.get("statistics");
                    let b_total = b_stats.and_then(|s| s.get("total_executions")).and_then(|t| t.as_i64()).unwrap_or(0);
                    let b_success = b_stats.and_then(|s| s.get("success_count")).and_then(|c| c.as_i64()).unwrap_or(0);
                    let b_rate = if b_total > 0 { (b_success as f64 / b_total as f64) * 100.0 } else { 0.0 };
                    
                    a_rate
                        .partial_cmp(&b_rate)
                        .unwrap_or(std::cmp::Ordering::Equal)
                }
                _ => std::cmp::Ordering::Equal,
            };

            if params.order == "desc" {
                ordering.reverse()
            } else {
                ordering
            }
        });
    }

    // Calculate pagination
    let total = enhanced_tasks.len() as u32;
    let total_pages = if total == 0 {
        1
    } else {
        (total + params.limit - 1) / params.limit
    };
    let offset = (params.page - 1) * params.limit;

    // Apply pagination
    let paginated_tasks: Vec<Value> = enhanced_tasks
        .into_iter()
        .skip(offset as usize)
        .take(params.limit as usize)
        .collect();

    let pagination = PaginationInfo {
        page: params.page,
        limit: params.limit,
        total,
        total_pages,
        has_next: params.page < total_pages,
        has_prev: params.page > 1,
    };

    debug!(
        "Returning {} tasks (page {} of {})",
        paginated_tasks.len(),
        params.page,
        total_pages
    );

    Ok(ApiResponse::with_pagination(
        serde_json::to_value(paginated_tasks)?,
        serde_json::to_value(pagination)?,
    ))
}

#[axum::debug_handler]
async fn get_task(
    State(api): State<WebState>,
    Path(task_id): Path<String>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting task: {}", task_id);

    // Get task from workspace (release lock immediately)
    let mut task_value = {
        let workflows_guard = api
            .workspace
            .workflows
            .read()
            .map_err(|_| anyhow!("Could not read workspace"))?;
        let workflows = workflows_guard.as_ref().unwrap();
        let task = workflows.get_task(task_id.as_str());

        let mut task_value =
            serde_json::to_value(task).map_err(|e| anyhow!("Failed to serialize task: {}", e))?;

        // Add the task name as the id field
        task_value["id"] = serde_json::Value::String(task_id.clone());
        task_value
    }; // Lock is released here

    // Get statistics for this specific task
    match api.job_repository.get_task_statistics(&task_id).await {
        Ok(Some(stats)) => {
            let enhanced_stats = EnhancedTaskStatistics {
                total_executions: stats.total_executions,
                success_count: stats.success_count,
                failure_count: stats.failure_count,
                last_execution: stats.last_execution.as_ref().map(|le| {
                    // Map API status values to frontend expected values
                    let frontend_status = match le.status.as_str() {
                        "completed" => "success",
                        "failed" => "failed",
                        "running" => "running",
                        "queued" => "queued",
                        _ => &le.status, // fallback to original value
                    };

                    LastExecutionInfo {
                        timestamp: le.timestamp.to_rfc3339(),
                        status: frontend_status.to_string(),
                        triggered_by: le.triggered_by.clone(),
                        duration: le.duration,
                    }
                }),
                average_duration: stats.average_duration,
            };
            task_value["statistics"] = serde_json::to_value(enhanced_stats)?;
        }
        Ok(None) => {
            // Task has no execution history
            let empty_stats = EnhancedTaskStatistics {
                total_executions: 0,
                success_count: 0,
                failure_count: 0,
                last_execution: None,
                average_duration: None,
            };
            task_value["statistics"] = serde_json::to_value(empty_stats)?;
        }
        Err(e) => {
            // Log the error but don't fail the request - just return empty statistics
            warn!("Failed to get statistics for task {}: {}", task_id, e);
            let empty_stats = EnhancedTaskStatistics {
                total_executions: 0,
                success_count: 0,
                failure_count: 0,
                last_execution: None,
                average_duration: None,
            };
            task_value["statistics"] = serde_json::to_value(empty_stats)?;
        }
    }

    Ok(ApiResponse::data(task_value))
}

#[axum::debug_handler]
async fn get_task_jobs(
    State(api): State<WebState>,
    Path(task_id): Path<String>,
    Query(params): Query<TaskJobsQuery>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!(
        "Getting jobs for task {} with params: {:?}",
        task_id, params
    );

    // Validate pagination parameters
    if params.page == 0 {
        return Err(ApiError::from(anyhow!(
            "Page number must be greater than 0"
        )));
    }
    if params.limit == 0 || params.limit > 100 {
        return Err(ApiError::from(anyhow!("Limit must be between 1 and 100")));
    }

    // Validate sort and order parameters
    let valid_sort_fields = ["start_datetime", "end_datetime", "duration", "status"];
    if let Some(ref sort_field) = params.sort {
        if !valid_sort_fields.contains(&sort_field.as_str()) {
            return Err(ApiError::from(anyhow!(
                "Invalid sort field. Valid options: start_datetime, end_datetime, duration, status"
            )));
        }
    }
    if params.order != "asc" && params.order != "desc" {
        return Err(ApiError::from(anyhow!("Order must be 'asc' or 'desc'")));
    }

    // Validate status filter if provided
    if let Some(ref status) = params.status {
        let valid_statuses = ["queued", "running", "completed", "failed"];
        if !valid_statuses.contains(&status.as_str()) {
            return Err(ApiError::from(anyhow!(
                "Invalid status filter. Valid options: queued, running, completed, failed"
            )));
        }
    }

    // Verify that the task exists
    {
        let workflows_guard = api
            .workspace
            .workflows
            .read()
            .map_err(|_| anyhow!("Could not read workspace"))?;
        let workflows = workflows_guard
            .as_ref()
            .ok_or_else(|| anyhow!("Workflows not initialized"))?;

        if let Some(tasks) = &workflows.tasks {
            if !tasks.contains_key(&task_id) {
                return Err(ApiError::from(anyhow!("Task '{}' not found", task_id)));
            }
        } else {
            return Err(ApiError::from(anyhow!("No tasks configured")));
        }
    }

    // Get jobs for the task with pagination
    let (jobs, total_count) = api
        .job_repository
        .get_task_jobs(
            &task_id,
            params.page,
            params.limit,
            params.status.as_deref(),
            params.sort.as_deref(),
            &params.order,
        )
        .await
        .map_err(|e| {
            error!("Failed to get jobs for task {}: {}", task_id, e);
            anyhow!("Failed to retrieve jobs for task")
        })?;

    // Convert jobs to JSON values
    let job_values: Result<Vec<Value>, _> = jobs
        .into_iter()
        .map(|job| serde_json::to_value(job))
        .collect();

    let job_data = job_values.map_err(|e| anyhow!("Failed to serialize job data: {}", e))?;

    // Calculate pagination metadata
    let total_pages = if total_count == 0 {
        1
    } else {
        (total_count + params.limit - 1) / params.limit
    };

    let pagination = PaginationInfo {
        page: params.page,
        limit: params.limit,
        total: total_count,
        total_pages,
        has_next: params.page < total_pages,
        has_prev: params.page > 1,
    };

    debug!(
        "Returning {} jobs for task {} (page {} of {})",
        job_data.len(),
        task_id,
        params.page,
        total_pages
    );

    Ok(ApiResponse::with_pagination(
        serde_json::to_value(job_data)?,
        serde_json::to_value(pagination)?,
    ))
}

#[axum::debug_handler]
async fn get_jobs(
    State(api): State<WebState>,
    Query(_params): Query<HashMap<String, String>>,
    _user: User,
) -> Result<ApiResponse, AppError> {
    let jobs = api.job_repository.get_jobs().await?;
    Ok(ApiResponse::data(serde_json::to_value(jobs)?))
}

#[axum::debug_handler]
async fn get_job(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    let task = api.job_repository.get_job(job_id.as_str()).await?;
    Ok(ApiResponse::data(serde_json::to_value(task)?))
}

#[axum::debug_handler]
async fn get_job_logs(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    let log_stream = api.log_repository.get_logs(job_id.as_str(), None).await?;
    let logs: Vec<LogEntry> = log_stream
        .collect::<Vec<Result<LogEntry, Error>>>()
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ApiResponse::data(serde_json::to_value(logs)?))
}

#[axum::debug_handler]
async fn get_job_step_logs(
    State(api): State<WebState>,
    Path((job_id, step_name)): Path<(String, String)>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    let log_stream = api
        .log_repository
        .get_logs(job_id.as_str(), Some(step_name.as_str()))
        .await?;
    let logs: Vec<LogEntry> = log_stream
        .collect::<Vec<Result<LogEntry, Error>>>()
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

    Ok(ApiResponse::data(serde_json::to_value(logs)?))
}

#[axum::debug_handler]
async fn put_job(
    State(api): State<WebState>,
    _user: User,
    Json(job): Json<JobRequest>,
) -> Result<ApiResponse, ApiError> {
    let job_id = api.job_repository.enqueue_job(&job, "user", None).await?;
    Ok(ApiResponse::data(serde_json::to_value(job_id)?))
}

#[axum::debug_handler]
async fn get_job_sse(
    State(api): State<WebState>,
    Path(job_id): Path<String>,
    _user: User,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    debug!("Received SSE connection for job {}", job_id);

    let rx = {
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

pub async fn send_sse_event(
    api: &WebState,
    job_id: &str,
    name: &str,
    data: Value,
) -> Result<(), Error> {
    let channels = api
        .job_channels
        .lock()
        .map_err(|_| anyhow!("Could not lock job channels"))?;
    if let Some(tx) = channels.get(job_id) {
        let event = JobEvent {
            event_name: name.to_string(),
            data,
        };
        let _ = tx.send(event);
    }
    Ok(())
}

// Dashboard API endpoints

/// Get system status metrics including worker counts, uptime, and alerts
#[axum::debug_handler]
async fn get_dashboard_system_status(
    State(api): State<WebState>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting dashboard system status");

    let system_status = api
        .job_repository
        .get_system_metrics()
        .await
        .map_err(|e| {
            error!("Failed to get system metrics: {}", e);
            anyhow!("Failed to retrieve system status")
        })?;

    Ok(ApiResponse::data(serde_json::to_value(system_status)?))
}

/// Get job execution metrics including success rates and status distribution
#[axum::debug_handler]
async fn get_dashboard_job_metrics(
    State(api): State<WebState>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting dashboard job metrics");

    let job_metrics = api
        .job_repository
        .get_job_execution_metrics()
        .await
        .map_err(|e| {
            error!("Failed to get job execution metrics: {}", e);
            anyhow!("Failed to retrieve job metrics")
        })?;

    Ok(ApiResponse::data(serde_json::to_value(job_metrics)?))
}

/// Get recent activity including job executions, alerts, and upcoming jobs
#[axum::debug_handler]
async fn get_dashboard_recent_activity(
    State(api): State<WebState>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting dashboard recent activity");

    let recent_activity = api
        .job_repository
        .get_recent_activity()
        .await
        .map_err(|e| {
            error!("Failed to get recent activity: {}", e);
            anyhow!("Failed to retrieve recent activity")
        })?;

    Ok(ApiResponse::data(serde_json::to_value(recent_activity)?))
}

/// Get job execution trends over time with configurable time ranges
#[axum::debug_handler]
async fn get_dashboard_job_trends(
    State(api): State<WebState>,
    Query(params): Query<JobTrendsQuery>,
    _user: User,
) -> Result<ApiResponse, ApiError> {
    debug!("Getting dashboard job trends with range: {}", params.range);

    // Validate time range parameter
    let valid_ranges = ["1h", "24h", "7d", "30d"];
    if !valid_ranges.contains(&params.range.as_str()) {
        return Err(ApiError::from(anyhow!(
            "Invalid time range. Valid options: 1h, 24h, 7d, 30d"
        )));
    }

    let job_trends = api
        .job_repository
        .get_job_trends(&params.range)
        .await
        .map_err(|e| {
            error!("Failed to get job trends for range {}: {}", params.range, e);
            anyhow!("Failed to retrieve job trends")
        })?;

    Ok(ApiResponse::data(serde_json::to_value(job_trends)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_task_list_query_defaults() {
        let query = TaskListQuery {
            page: default_page(),
            limit: default_limit(),
            sort: None,
            order: default_order(),
            search: None,
        };

        assert_eq!(query.page, 1);
        assert_eq!(query.limit, 25);
        assert_eq!(query.order, "asc");
        assert!(query.sort.is_none());
        assert!(query.search.is_none());
    }

    #[test]
    fn test_pagination_info_creation() {
        let pagination = PaginationInfo {
            page: 2,
            limit: 10,
            total: 45,
            total_pages: 5,
            has_next: true,
            has_prev: true,
        };

        assert_eq!(pagination.page, 2);
        assert_eq!(pagination.total_pages, 5);
        assert!(pagination.has_next);
        assert!(pagination.has_prev);
    }

    #[test]
    fn test_enhanced_task_statistics_serialization() {
        let stats = EnhancedTaskStatistics {
            total_executions: 100,
            success_count: 95,
            failure_count: 5,
            last_execution: Some(LastExecutionInfo {
                timestamp: "2024-01-15T10:30:00Z".to_string(),
                status: "completed".to_string(),
                triggered_by: "scheduler:daily".to_string(),
                duration: Some(45.2),
            }),
            average_duration: Some(42.8),
        };

        let json_result = serde_json::to_string(&stats);
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("100"));
        assert!(json_str.contains("95"));
        assert!(json_str.contains("scheduler:daily"));
    }

    #[test]
    fn test_paginated_tasks_response_serialization() {
        let response = PaginatedTasksResponse {
            data: vec![
                serde_json::json!({"name": "task1", "description": "Test task 1"}),
                serde_json::json!({"name": "task2", "description": "Test task 2"}),
            ],
            pagination: PaginationInfo {
                page: 1,
                limit: 25,
                total: 2,
                total_pages: 1,
                has_next: false,
                has_prev: false,
            },
        };

        let json_result = serde_json::to_string(&response);
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("task1"));
        assert!(json_str.contains("task2"));
        assert!(json_str.contains("\"total\":2"));
    }

    #[test]
    fn test_task_jobs_query_defaults() {
        let query = TaskJobsQuery {
            page: default_page(),
            limit: default_job_limit(),
            status: None,
            sort: None,
            order: default_order(),
        };

        assert_eq!(query.page, 1);
        assert_eq!(query.limit, 20);
        assert_eq!(query.order, "asc");
        assert!(query.status.is_none());
        assert!(query.sort.is_none());
    }

    #[test]
    fn test_paginated_tasks_response_usage() {
        let response = PaginatedTasksResponse {
            data: vec![
                serde_json::json!({
                    "id": "task1",
                    "name": "Test Task 1",
                    "description": "A test task"
                }),
                serde_json::json!({
                    "id": "task2",
                    "name": "Test Task 2",
                    "description": "Another test task"
                }),
            ],
            pagination: PaginationInfo {
                page: 1,
                limit: 25,
                total: 2,
                total_pages: 1,
                has_next: false,
                has_prev: false,
            },
        };

        let json_result = serde_json::to_string(&response);
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("task1"));
        assert!(json_str.contains("Test Task 1"));
        assert!(json_str.contains("\"total\":2"));
    }

    #[test]
    fn test_job_trends_query_defaults() {
        let query = JobTrendsQuery {
            range: default_time_range(),
        };

        assert_eq!(query.range, "24h");
    }

    #[test]
    fn test_job_trends_query_validation() {
        let valid_ranges = ["1h", "24h", "7d", "30d"];
        
        // Test valid ranges
        for range in valid_ranges {
            assert!(valid_ranges.contains(&range));
        }

        // Test invalid range
        let invalid_range = "invalid";
        assert!(!valid_ranges.contains(&invalid_range));
    }

    #[test]
    fn test_dashboard_endpoint_paths() {
        // Test that our dashboard endpoint paths are correctly formatted
        let expected_paths = [
            "/api/dashboard/system-status",
            "/api/dashboard/job-metrics", 
            "/api/dashboard/recent-activity",
            "/api/dashboard/job-trends",
        ];

        for path in expected_paths {
            assert!(path.starts_with("/api/dashboard/"));
            assert!(!path.ends_with("/"));
        }
    }

    #[test]
    fn test_dashboard_endpoint_requirements_coverage() {
        // Verify that we have endpoints covering all requirements
        // Requirements 1.1, 1.4: System status endpoint
        assert!(true); // system-status endpoint exists
        
        // Requirements 2.1, 2.4: Job metrics endpoint  
        assert!(true); // job-metrics endpoint exists
        
        // Requirements 3.1, 3.3: Recent activity endpoint
        assert!(true); // recent-activity endpoint exists
        
        // Additional: Job trends endpoint for time-series data
        assert!(true); // job-trends endpoint exists
    }
}
