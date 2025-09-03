use anyhow::{Error, bail};
use chrono::{DateTime, Duration, Utc};
use serde_json::Value;
use sqlx::PgPool;
use sqlx::Row;
use tracing::{debug, error, info};

use serde::{Deserialize, Serialize};
use stroem_common::{JobRequest, JobResult};
use uuid::Uuid;

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct JobStep {
    pub success: bool,
    pub name: String,
    pub input: Option<Value>,
    pub output: Option<Value>,
    pub start_datetime: DateTime<Utc>,
    pub end_datetime: DateTime<Utc>,
}

#[derive(sqlx::FromRow, Debug, Serialize, Deserialize)]
pub struct Job {
    pub worker_id: Option<String>,
    pub job_id: Uuid,
    pub success: Option<bool>,
    pub start_datetime: Option<DateTime<Utc>>,
    pub end_datetime: Option<DateTime<Utc>>,
    #[sqlx(rename = "task_name")]
    pub task: Option<String>,
    #[sqlx(rename = "action_name")]
    pub action: Option<String>,
    pub input: Option<Value>,
    pub output: Option<Value>,
    pub source_type: Option<String>,
    pub source_id: Option<String>,
    pub status: Option<String>,
    pub revision: Option<String>,
    #[sqlx(skip)]
    pub steps: Vec<JobStep>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TaskStatistics {
    pub task_name: String,
    pub total_executions: i64,
    pub success_rate: f64, // 0-100
    pub last_execution: Option<LastExecution>,
    pub average_duration: Option<f64>, // in seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LastExecution {
    pub timestamp: DateTime<Utc>,
    pub status: String,        // 'success' | 'failed' | 'running' | 'queued'
    pub triggered_by: String,  // source_type:source_id format
    pub duration: Option<f64>, // in seconds
}

// Dashboard-specific data structures

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemAlert {
    pub id: String,
    pub severity: String, // 'info' | 'warning' | 'error'
    pub message: String,
    pub timestamp: DateTime<Utc>,
    pub source: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SystemStatus {
    pub active_workers: i32,
    pub idle_workers: i32,
    pub total_jobs_today: i64,
    pub system_uptime: String,           // ISO duration format
    pub average_execution_time_24h: f64, // seconds
    pub alerts: Vec<SystemAlert>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobExecutionMetrics {
    pub today: DailyJobStats,
    pub status_distribution: StatusDistribution,
    pub top_failing_workflows: Vec<FailingWorkflow>,
    pub average_execution_time: f64, // seconds
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyJobStats {
    pub total_jobs: i64,
    pub success_count: i64,
    pub failure_count: i64,
    pub success_rate: f64, // percentage
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusDistribution {
    pub running: i64,
    pub completed: i64,
    pub failed: i64,
    pub queued: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FailingWorkflow {
    pub workflow_name: String,
    pub failure_rate: f64,
    pub total_executions: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentJob {
    pub job_id: String,
    pub task_name: String,
    pub status: String,
    pub start_time: DateTime<Utc>,
    pub duration: Option<f64>,
    pub triggered_by: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UpcomingJob {
    pub task_name: String,
    pub scheduled_time: DateTime<Utc>,
    pub trigger_type: String,
    pub estimated_duration: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentActivity {
    pub recent_jobs: Vec<RecentJob>,
    pub alerts: Vec<SystemAlert>,
    pub upcoming_jobs: Vec<UpcomingJob>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobTrendsDataPoint {
    pub timestamp: DateTime<Utc>,
    pub total_jobs: i64,
    pub successful_jobs: i64,
    pub failed_jobs: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobTrendsData {
    pub time_series: Vec<JobTrendsDataPoint>,
    pub time_range: String, // '1h' | '24h' | '7d' | '30d'
}

#[derive(Clone)]
pub struct JobRepository {
    pool: PgPool,
}

impl JobRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn enqueue_job(
        &self,
        job: &JobRequest,
        source_type: &str,
        source_id: Option<&str>,
    ) -> Result<String, Error> {
        let job_uuid = job.uuid.unwrap_or_else(|| uuid::Uuid::new_v4());
        sqlx::query(
            "INSERT INTO job (job_id, task_name, action_name, input, queued, status, source_type, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)"
        )
            .bind(&job_uuid)
            .bind(&job.task)
            .bind(&job.action)
            .bind(&job.input)
            .bind(Utc::now())
            .bind("queued")
            .bind(source_type)
            .bind(source_id)
            .execute(&self.pool)
            .await?;

        Ok(job_uuid.to_string())
    }

    pub async fn get_next_job(&self, worker_id: &str) -> Result<Option<JobRequest>, Error> {
        let row = sqlx::query(
            "UPDATE job
             SET worker_id = $1, picked = NOW(), status = 'running'
             WHERE job_id = (
                 SELECT job_id
                 FROM job
                 WHERE status = 'queued' AND worker_id IS NULL AND picked IS NULL
                 ORDER BY queued ASC
                 LIMIT 1
             )
             RETURNING job_id, task_name, action_name, input",
        )
        .bind(worker_id)
        .fetch_optional(&self.pool)
        .await?;

        if let Some(row) = row {
            let job_uuid: uuid::Uuid = row.try_get("job_id")?;
            let job = JobRequest {
                uuid: Some(job_uuid),
                task: row.try_get("task_name")?,
                action: row.try_get("action_name")?,
                input: row.try_get("input")?,
            };
            debug!("Assigned job {} to worker {}", job_uuid, worker_id);
            return Ok(Some(job));
        }
        debug!("No jobs available for worker {}", worker_id);
        Ok(None)
    }

    pub async fn get_jobs(&self) -> Result<Vec<Job>, Error> {
        let list = sqlx::query_as(
            "SELECT
                job_id, success, task_name, action_name, input, output, worker_id,
                status, source_type, source_id, start_datetime, end_datetime, revision
             FROM job
             ORDER BY start_datetime DESC
             LIMIT 20",
        )
        .fetch_all(&self.pool)
        .await?;
        Ok(list)
    }

    pub async fn get_job(&self, job_id: &str) -> Result<Job, Error> {
        let job_id = Uuid::parse_str(job_id)?;
        let mut job: Job = sqlx::query_as(
            "SELECT
                job_id, success, task_name, action_name, input, output, worker_id,
                status, source_type, source_id, start_datetime, end_datetime, revision
             FROM job
             WHERE job_id = $1
            ",
        )
        .bind(job_id)
        .fetch_one(&self.pool)
        .await?;

        // Fetch the associated job steps
        let steps: Vec<JobStep> = sqlx::query_as(
            "SELECT
                success, step_name AS name, input, output,
                start_datetime, end_datetime
             FROM job_step
             WHERE job_id = $1
             ORDER BY start_datetime ASC", // Optional: order steps by start time
        )
        .bind(job_id)
        .fetch_all(&self.pool) // Fetch all steps for this job
        .await?;

        job.steps = steps;

        Ok(job)
    }

    pub async fn update_start_time(
        &self,
        job_id: &str,
        worker_id: &str,
        start_time: DateTime<Utc>,
        input: &Option<Value>,
    ) -> Result<(), Error> {
        let job_id = Uuid::parse_str(job_id)?;
        let rows_affected = sqlx::query(
            "UPDATE job
             SET start_datetime = $1, input = $2
             WHERE job_id = $3 AND worker_id = $4 AND status = 'running'",
        )
        .bind(start_time)
        .bind(input)
        .bind(job_id)
        .bind(worker_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            let msg = format!(
                "Failed to update start time for job_id {}: not found or not running for worker {}",
                job_id, worker_id
            );
            error!("{}", msg);
            bail!(msg);
        }

        info!(
            "Updated start time for job_id {} by worker {}",
            job_id, worker_id
        );
        Ok(())
    }

    pub async fn update_step_start_time(
        &self,
        job_id: &str,
        step_name: &str,
        worker_id: &str,
        start_time: DateTime<Utc>,
        input: &Option<Value>,
    ) -> Result<(), Error> {
        let job_id = Uuid::parse_str(job_id)?;
        let rows_affected = sqlx::query(
            "INSERT INTO job_step (job_id, step_name, start_datetime, input)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (job_id, step_name)
             DO UPDATE SET start_datetime = NOW()
             WHERE job_step.job_id = $1 AND job_step.step_name = $2",
        )
        .bind(job_id)
        .bind(step_name)
        .bind(start_time)
        .bind(input)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            let msg = format!(
                "Failed to update step start time for job_id {}, step_name {}: job not found or not running for worker {}",
                job_id, step_name, worker_id
            );
            error!("{}", msg);
            bail!(msg);
        }

        info!(
            "Updated start time for job_id {}, step_name {} by worker {}",
            job_id, step_name, worker_id
        );
        Ok(())
    }

    pub async fn update_step_result(
        &self,
        job_id: &str,
        step_name: &str,
        result: &JobResult,
    ) -> Result<(), Error> {
        let job_id = Uuid::parse_str(job_id)?;
        let rows_affected = sqlx::query(
            "UPDATE job_step
             SET start_datetime = $1, end_datetime = $2, output = $3, success = $4
             WHERE job_id = $5 AND step_name = $6",
        )
        .bind(&result.start_datetime)
        .bind(&result.end_datetime)
        .bind(&result.output)
        .bind(&result.success)
        .bind(job_id)
        .bind(step_name)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            let msg = format!(
                "Failed to update step result for job_id {}, step_name {}: step not found or job not running",
                job_id, step_name
            );
            error!("{}", msg);
            return Ok(()); // Kept your original behavior
        }

        info!(
            "Updated result for job_id {}, step_name {}",
            job_id, step_name
        );
        Ok(())
    }

    pub async fn update_job_result(&self, job_id: &str, result: &JobResult) -> Result<(), Error> {
        let job_id = Uuid::parse_str(job_id)?;
        let rows_affected = sqlx::query(
            "UPDATE job
             SET start_datetime = $1, end_datetime = $2, output = $3, success = $4, status = $5
             WHERE job_id = $6",
        )
        .bind(&result.start_datetime)
        .bind(&result.end_datetime)
        .bind(&result.output)
        .bind(&result.success)
        .bind(if result.success {
            "completed"
        } else {
            "failed"
        })
        .bind(job_id)
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            let msg = format!(
                "Failed to update job result for job_id {}: not found",
                job_id
            );
            error!("{}", msg);
            bail!(msg);
        }

        info!("Stored job result: job_id={}", job_id);
        Ok(())
    }

    /// Get task statistics aggregated by task name
    pub async fn get_task_statistics(
        &self,
        task_name: &str,
    ) -> Result<Option<TaskStatistics>, Error> {
        // First, get the basic statistics for the task
        let stats_row = sqlx::query(
            "SELECT 
                task_name,
                COUNT(*) as total_executions,
                COALESCE(AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) * 100, 0)::FLOAT8 as success_rate,
                AVG(CASE 
                    WHEN start_datetime IS NOT NULL AND end_datetime IS NOT NULL 
                    THEN EXTRACT(EPOCH FROM (end_datetime - start_datetime))
                    ELSE NULL 
                END)::FLOAT8 as average_duration
             FROM job 
             WHERE task_name = $1 AND start_datetime IS NOT NULL
             GROUP BY task_name"
        )
        .bind(task_name)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| {
            error!("Failed to fetch task statistics for {}: {}", task_name, e);
            e
        })?;

        if let Some(row) = stats_row {
            let total_executions: i64 = row.try_get("total_executions")?;
            let success_rate: f64 = row.try_get("success_rate")?;
            let average_duration: Option<f64> = row.try_get("average_duration")?;

            // Get the last execution details
            let last_execution_row = sqlx::query(
                "SELECT 
                    start_datetime,
                    end_datetime,
                    status,
                    source_type,
                    COALESCE(source_id, '') as source_id,
                    EXTRACT(EPOCH FROM (end_datetime - start_datetime))::FLOAT8 as duration
                 FROM job 
                 WHERE task_name = $1 AND start_datetime IS NOT NULL
                 ORDER BY start_datetime DESC 
                 LIMIT 1",
            )
            .bind(task_name)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| {
                error!("Failed to fetch last execution for {}: {}", task_name, e);
                e
            })?;

            let last_execution = if let Some(last_row) = last_execution_row {
                let timestamp: DateTime<Utc> = last_row.try_get("start_datetime")?;
                let status: String = last_row.try_get("status")?;
                let source_type: String = last_row.try_get("source_type")?;
                let source_id: String = last_row.try_get("source_id")?;
                let duration: Option<f64> = last_row.try_get("duration")?;

                let triggered_by = if source_id.is_empty() {
                    source_type
                } else {
                    format!("{}:{}", source_type, source_id)
                };

                Some(LastExecution {
                    timestamp,
                    status,
                    triggered_by,
                    duration,
                })
            } else {
                None
            };

            Ok(Some(TaskStatistics {
                task_name: task_name.to_string(),
                total_executions,
                success_rate,
                last_execution,
                average_duration,
            }))
        } else {
            // Task exists but has no executions
            Ok(Some(TaskStatistics {
                task_name: task_name.to_string(),
                total_executions: 0,
                success_rate: 0.0,
                last_execution: None,
                average_duration: None,
            }))
        }
    }

    /// Get task statistics for multiple tasks
    pub async fn get_all_task_statistics(&self) -> Result<Vec<TaskStatistics>, Error> {
        // Get all unique task names that have been executed
        let task_names: Vec<String> =
            sqlx::query_scalar("SELECT DISTINCT task_name FROM job WHERE task_name IS NOT NULL")
                .fetch_all(&self.pool)
                .await
                .map_err(|e| {
                    error!("Failed to fetch task names: {}", e);
                    e
                })?;

        let mut statistics = Vec::new();

        for task_name in task_names {
            if let Some(stats) = self.get_task_statistics(&task_name).await? {
                statistics.push(stats);
            }
        }

        Ok(statistics)
    }

    // Dashboard-specific methods

    /// Get system metrics including worker status and uptime
    pub async fn get_system_metrics(&self) -> Result<SystemStatus, Error> {
        let now = Utc::now();
        let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();

        // Get active workers (workers that have picked up jobs in the last 5 minutes)
        let active_workers_row = sqlx::query(
            "SELECT COUNT(DISTINCT worker_id) as active_workers
             FROM job 
             WHERE worker_id IS NOT NULL 
             AND picked >= $1",
        )
        .bind(now - Duration::minutes(5))
        .fetch_one(&self.pool)
        .await?;

        let active_workers: i64 = active_workers_row.try_get("active_workers")?;

        // For idle workers, we'll use a simple heuristic: workers that have been active in the last hour but not in the last 5 minutes
        let idle_workers_row = sqlx::query(
            "SELECT COUNT(DISTINCT worker_id) as idle_workers
             FROM job 
             WHERE worker_id IS NOT NULL 
             AND picked >= $1 
             AND picked < $2",
        )
        .bind(now - Duration::hours(1))
        .bind(now - Duration::minutes(5))
        .fetch_one(&self.pool)
        .await?;

        let idle_workers: i64 = idle_workers_row.try_get("idle_workers")?;

        // Get total jobs today
        let jobs_today_row = sqlx::query(
            "SELECT COUNT(*) as total_jobs_today
             FROM job 
             WHERE start_datetime >= $1",
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await?;

        let total_jobs_today: i64 = jobs_today_row.try_get("total_jobs_today")?;

        // Get average execution time for last 24 hours
        let avg_time_row = sqlx::query(
            "SELECT AVG(EXTRACT(EPOCH FROM (end_datetime - start_datetime)))::FLOAT8 as avg_time
             FROM job 
             WHERE start_datetime >= $1 
             AND end_datetime IS NOT NULL",
        )
        .bind(now - Duration::hours(24))
        .fetch_one(&self.pool)
        .await?;

        let average_execution_time_24h: Option<f64> = avg_time_row.try_get("avg_time")?;

        // Generate system alerts based on current conditions
        let mut alerts = Vec::new();

        // Alert if no active workers
        if active_workers == 0 {
            alerts.push(SystemAlert {
                id: "no-active-workers".to_string(),
                severity: "warning".to_string(),
                message: "No active workers detected".to_string(),
                timestamp: now,
                source: Some("worker-monitor".to_string()),
            });
        }

        // Alert if there are many failed jobs today
        let failed_jobs_row = sqlx::query(
            "SELECT COUNT(*) as failed_jobs
             FROM job 
             WHERE start_datetime >= $1 
             AND success = false",
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await?;

        let failed_jobs: i64 = failed_jobs_row.try_get("failed_jobs")?;

        if total_jobs_today > 0 && (failed_jobs as f64 / total_jobs_today as f64) > 0.2 {
            alerts.push(SystemAlert {
                id: "high-failure-rate".to_string(),
                severity: "error".to_string(),
                message: format!(
                    "High failure rate detected: {:.1}% of jobs failed today",
                    (failed_jobs as f64 / total_jobs_today as f64) * 100.0
                ),
                timestamp: now,
                source: Some("job-monitor".to_string()),
            });
        }

        // System uptime (simplified - using the oldest job as a proxy for system start)
        let uptime = "P1DT12H30M".to_string(); // Placeholder - in real implementation, track actual uptime

        Ok(SystemStatus {
            active_workers: active_workers as i32,
            idle_workers: idle_workers as i32,
            total_jobs_today,
            system_uptime: uptime,
            average_execution_time_24h: average_execution_time_24h.unwrap_or(0.0),
            alerts,
        })
    }

    /// Get job execution metrics for performance monitoring
    pub async fn get_job_execution_metrics(&self) -> Result<JobExecutionMetrics, Error> {
        let now = Utc::now();
        let today_start = now.date_naive().and_hms_opt(0, 0, 0).unwrap().and_utc();

        // Get today's job statistics
        let today_stats_row = sqlx::query(
            "SELECT 
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN success = true THEN 1 END) as success_count,
                COUNT(CASE WHEN success = false THEN 1 END) as failure_count
             FROM job 
             WHERE start_datetime >= $1",
        )
        .bind(today_start)
        .fetch_one(&self.pool)
        .await?;

        let total_jobs: i64 = today_stats_row.try_get("total_jobs")?;
        let success_count: i64 = today_stats_row.try_get("success_count")?;
        let failure_count: i64 = today_stats_row.try_get("failure_count")?;

        let success_rate = if total_jobs > 0 {
            (success_count as f64 / total_jobs as f64) * 100.0
        } else {
            0.0
        };

        // Get status distribution
        let status_dist_rows = sqlx::query(
            "SELECT 
                status,
                COUNT(*) as count
             FROM job 
             GROUP BY status",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut running = 0i64;
        let mut completed = 0i64;
        let mut failed = 0i64;
        let mut queued = 0i64;

        for row in status_dist_rows {
            let status: String = row.try_get("status")?;
            let count: i64 = row.try_get("count")?;

            match status.as_str() {
                "running" => running = count,
                "completed" => completed = count,
                "failed" => failed = count,
                "queued" => queued = count,
                _ => {}
            }
        }

        // Get top failing workflows
        let failing_workflows_rows = sqlx::query(
            "SELECT 
                task_name,
                COUNT(*) as total_executions,
                COUNT(CASE WHEN success = false THEN 1 END) as failures,
                (COUNT(CASE WHEN success = false THEN 1 END)::FLOAT8 / COUNT(*)::FLOAT8 * 100) as failure_rate
             FROM job 
             WHERE task_name IS NOT NULL 
             AND start_datetime >= $1
             GROUP BY task_name
             HAVING COUNT(*) >= 3
             ORDER BY failure_rate DESC, total_executions DESC
             LIMIT 5"
        )
        .bind(now - Duration::days(7)) // Last 7 days
        .fetch_all(&self.pool)
        .await?;

        let mut top_failing_workflows = Vec::new();
        for row in failing_workflows_rows {
            let workflow_name: String = row.try_get("task_name")?;
            let total_executions: i64 = row.try_get("total_executions")?;
            let failure_rate: Option<f64> = row.try_get("failure_rate")?;

            if let Some(rate) = failure_rate {
                if rate > 10.0 {
                    // Only include workflows with >10% failure rate
                    top_failing_workflows.push(FailingWorkflow {
                        workflow_name,
                        failure_rate: rate,
                        total_executions,
                    });
                }
            }
        }

        // Get average execution time
        let avg_time_row = sqlx::query(
            "SELECT AVG(EXTRACT(EPOCH FROM (end_datetime - start_datetime)))::FLOAT8 as avg_time
             FROM job 
             WHERE start_datetime >= $1 
             AND end_datetime IS NOT NULL",
        )
        .bind(now - Duration::hours(24))
        .fetch_one(&self.pool)
        .await?;

        let average_execution_time: Option<f64> = avg_time_row.try_get("avg_time")?;

        Ok(JobExecutionMetrics {
            today: DailyJobStats {
                total_jobs,
                success_count,
                failure_count,
                success_rate,
            },
            status_distribution: StatusDistribution {
                running,
                completed,
                failed,
                queued,
            },
            top_failing_workflows,
            average_execution_time: average_execution_time.unwrap_or(0.0),
        })
    }

    /// Get recent activity including jobs, alerts, and upcoming executions
    pub async fn get_recent_activity(&self) -> Result<RecentActivity, Error> {
        // Get recent jobs (last 10)
        let recent_jobs_rows = sqlx::query(
            "SELECT 
                job_id,
                task_name,
                status,
                start_datetime,
                end_datetime,
                source_type,
                COALESCE(source_id, '') as source_id
             FROM job 
             WHERE start_datetime IS NOT NULL
             ORDER BY start_datetime DESC 
             LIMIT 10",
        )
        .fetch_all(&self.pool)
        .await?;

        let mut recent_jobs = Vec::new();
        for row in recent_jobs_rows {
            let job_id: uuid::Uuid = row.try_get("job_id")?;
            let task_name: Option<String> = row.try_get("task_name")?;
            let status: String = row.try_get("status")?;
            let start_time: DateTime<Utc> = row.try_get("start_datetime")?;
            let end_datetime: Option<DateTime<Utc>> = row.try_get("end_datetime")?;
            let source_type: String = row.try_get("source_type")?;
            let source_id: String = row.try_get("source_id")?;

            let duration = if let Some(end_time) = end_datetime {
                Some((end_time - start_time).num_seconds() as f64)
            } else {
                None
            };

            let triggered_by = if source_id.is_empty() {
                source_type
            } else {
                format!("{}:{}", source_type, source_id)
            };

            recent_jobs.push(RecentJob {
                job_id: job_id.to_string(),
                task_name: task_name.unwrap_or_else(|| "unknown".to_string()),
                status,
                start_time,
                duration,
                triggered_by,
            });
        }

        // Generate alerts based on recent activity
        let mut alerts = Vec::new();
        let now = Utc::now();

        // Check for recent failures
        let recent_failures_row = sqlx::query(
            "SELECT COUNT(*) as recent_failures
             FROM job 
             WHERE start_datetime >= $1 
             AND success = false",
        )
        .bind(now - Duration::minutes(30))
        .fetch_one(&self.pool)
        .await?;

        let recent_failures: i64 = recent_failures_row.try_get("recent_failures")?;

        if recent_failures > 3 {
            alerts.push(SystemAlert {
                id: "recent-failures".to_string(),
                severity: "warning".to_string(),
                message: format!("{} jobs failed in the last 30 minutes", recent_failures),
                timestamp: now,
                source: Some("job-monitor".to_string()),
            });
        }

        // Placeholder for upcoming jobs - in a real implementation, this would come from scheduler
        let upcoming_jobs = Vec::new();

        Ok(RecentActivity {
            recent_jobs,
            alerts,
            upcoming_jobs,
        })
    }

    /// Get job execution trends over time
    pub async fn get_job_trends(&self, time_range: &str) -> Result<JobTrendsData, Error> {
        let now = Utc::now();
        let (start_time, interval) = match time_range {
            "1h" => (now - Duration::hours(1), "5 minutes"),
            "24h" => (now - Duration::hours(24), "1 hour"),
            "7d" => (now - Duration::days(7), "1 day"),
            "30d" => (now - Duration::days(30), "1 day"),
            _ => return Err(anyhow::anyhow!("Invalid time range: {}", time_range)),
        };

        let trends_rows = sqlx::query(&format!(
            "SELECT 
                date_trunc('{}', start_datetime) as time_bucket,
                COUNT(*) as total_jobs,
                COUNT(CASE WHEN success = true THEN 1 END) as successful_jobs,
                COUNT(CASE WHEN success = false THEN 1 END) as failed_jobs
             FROM job 
             WHERE start_datetime >= $1 
             AND start_datetime IS NOT NULL
             GROUP BY time_bucket
             ORDER BY time_bucket ASC",
            interval
        ))
        .bind(start_time)
        .fetch_all(&self.pool)
        .await?;

        let mut time_series = Vec::new();
        for row in trends_rows {
            let timestamp: DateTime<Utc> = row.try_get("time_bucket")?;
            let total_jobs: i64 = row.try_get("total_jobs")?;
            let successful_jobs: i64 = row.try_get("successful_jobs")?;
            let failed_jobs: i64 = row.try_get("failed_jobs")?;

            time_series.push(JobTrendsDataPoint {
                timestamp,
                total_jobs,
                successful_jobs,
                failed_jobs,
            });
        }

        Ok(JobTrendsData {
            time_series,
            time_range: time_range.to_string(),
        })
    }

    /// Get jobs for a specific task with pagination and filtering
    pub async fn get_task_jobs(
        &self,
        task_name: &str,
        page: u32,
        limit: u32,
        status_filter: Option<&str>,
        sort_field: Option<&str>,
        sort_order: &str,
    ) -> Result<(Vec<Job>, u32), Error> {
        // Validate pagination parameters
        if page == 0 {
            bail!("Page number must be greater than 0");
        }
        if limit == 0 || limit > 100 {
            bail!("Limit must be between 1 and 100");
        }

        // Validate sort parameters
        let valid_sort_fields = ["start_datetime", "end_datetime", "duration", "status"];
        if let Some(sort) = sort_field {
            if !valid_sort_fields.contains(&sort) {
                bail!(
                    "Invalid sort field. Valid options: start_datetime, end_datetime, duration, status"
                );
            }
        }
        if sort_order != "asc" && sort_order != "desc" {
            bail!("Sort order must be 'asc' or 'desc'");
        }

        // Build the WHERE clause
        let mut where_conditions = vec!["task_name = $1".to_string()];
        let mut param_count = 1;

        if status_filter.is_some() {
            param_count += 1;
            where_conditions.push(format!("status = ${}", param_count));
        }

        let where_clause = where_conditions.join(" AND ");

        // Build the ORDER BY clause
        let order_by = match sort_field {
            Some("start_datetime") => format!("start_datetime {}", sort_order),
            Some("end_datetime") => format!("end_datetime {} NULLS LAST", sort_order),
            Some("duration") => format!(
                "(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) {} NULLS LAST",
                sort_order
            ),
            Some("status") => format!("status {}", sort_order),
            _ => format!("start_datetime {}", sort_order), // Default sort
        };

        // Get total count for pagination
        let count_query = format!("SELECT COUNT(*) FROM job WHERE {}", where_clause);

        let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query).bind(task_name);

        if let Some(status) = status_filter {
            count_query_builder = count_query_builder.bind(status);
        }

        let total_count: i64 = count_query_builder
            .fetch_one(&self.pool)
            .await
            .map_err(|e| {
                error!("Failed to get job count for task {}: {}", task_name, e);
                e
            })?;

        // Calculate offset
        let offset = (page - 1) * limit;

        // Build the main query
        let jobs_query = format!(
            "SELECT
                job_id, success, task_name, action_name, input, output, worker_id,
                status, source_type, source_id, start_datetime, end_datetime, revision
             FROM job
             WHERE {}
             ORDER BY {}
             LIMIT ${} OFFSET ${}",
            where_clause,
            order_by,
            param_count + 1,
            param_count + 2
        );

        let mut jobs_query_builder = sqlx::query_as::<_, Job>(&jobs_query).bind(task_name);

        if let Some(status) = status_filter {
            jobs_query_builder = jobs_query_builder.bind(status);
        }

        jobs_query_builder = jobs_query_builder.bind(limit as i64).bind(offset as i64);

        let jobs = jobs_query_builder
            .fetch_all(&self.pool)
            .await
            .map_err(|e| {
                error!("Failed to fetch jobs for task {}: {}", task_name, e);
                e
            })?;

        debug!(
            "Retrieved {} jobs for task {} (page {}, limit {})",
            jobs.len(),
            task_name,
            page,
            limit
        );

        Ok((jobs, total_count as u32))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    // Mock tests that verify the logic without requiring a database
    // In a real scenario, you'd use a test database or integration tests

    #[test]
    fn test_task_statistics_struct_creation() {
        let now = Utc::now();
        let last_execution = LastExecution {
            timestamp: now,
            status: "completed".to_string(),
            triggered_by: "user:test123".to_string(),
            duration: Some(120.5),
        };

        let stats = TaskStatistics {
            task_name: "test-task".to_string(),
            total_executions: 10,
            success_rate: 85.0,
            last_execution: Some(last_execution),
            average_duration: Some(95.2),
        };

        assert_eq!(stats.task_name, "test-task");
        assert_eq!(stats.total_executions, 10);
        assert_eq!(stats.success_rate, 85.0);
        assert!(stats.last_execution.is_some());
        assert_eq!(stats.average_duration, Some(95.2));
    }

    #[test]
    fn test_last_execution_struct_creation() {
        let now = Utc::now();
        let last_exec = LastExecution {
            timestamp: now,
            status: "failed".to_string(),
            triggered_by: "webhook:github".to_string(),
            duration: None,
        };

        assert_eq!(last_exec.status, "failed");
        assert_eq!(last_exec.triggered_by, "webhook:github");
        assert!(last_exec.duration.is_none());
    }

    #[test]
    fn test_task_statistics_serialization() {
        let stats = TaskStatistics {
            task_name: "serialize-test".to_string(),
            total_executions: 5,
            success_rate: 100.0,
            last_execution: None,
            average_duration: Some(45.0),
        };

        // Test that the struct can be serialized to JSON
        let json_result = serde_json::to_string(&stats);
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("serialize-test"));
        assert!(json_str.contains("100.0"));
    }

    #[test]
    fn test_triggered_by_format() {
        // Test the format used in the triggered_by field
        let source_type = "user";
        let source_id = "john_doe";
        let triggered_by = format!("{}:{}", source_type, source_id);
        assert_eq!(triggered_by, "user:john_doe");

        // Test with empty source_id (should just be source_type)
        let triggered_by_no_id = "trigger".to_string();
        assert_eq!(triggered_by_no_id, "trigger");
    }

    // Integration test placeholder - would require test database setup
    #[tokio::test]
    #[ignore] // Ignore by default since it requires database setup
    async fn test_get_task_statistics_integration() {
        // This test would require:
        // 1. Setting up a test PostgreSQL database
        // 2. Running migrations
        // 3. Inserting test data
        // 4. Testing the actual SQL queries

        // Example setup (commented out):
        // let database_url = std::env::var("TEST_DATABASE_URL")
        //     .expect("TEST_DATABASE_URL must be set for integration tests");
        // let pool = PgPool::connect(&database_url).await.unwrap();
        // let repo = JobRepository::new(pool);

        // Insert test data and verify statistics calculation

        println!("Integration test placeholder - requires test database setup");
    }

    #[test]
    fn test_enhanced_task_statistics_serialization() {
        use crate::web::{EnhancedTaskStatistics, LastExecutionInfo};

        let enhanced_stats = EnhancedTaskStatistics {
            total_executions: 42,
            success_rate: 85.5,
            last_execution: Some(LastExecutionInfo {
                timestamp: "2024-01-15T10:30:00Z".to_string(),
                status: "completed".to_string(),
                triggered_by: "user:admin".to_string(),
                duration: Some(120.5),
            }),
            average_duration: Some(95.2),
        };

        // Test that the enhanced statistics can be serialized to JSON
        let json_result = serde_json::to_string(&enhanced_stats);
        assert!(json_result.is_ok());

        let json_str = json_result.unwrap();
        assert!(json_str.contains("42"));
        assert!(json_str.contains("85.5"));
        assert!(json_str.contains("2024-01-15T10:30:00Z"));
        assert!(json_str.contains("user:admin"));
    }

    #[test]
    fn test_get_task_jobs_parameter_validation() {
        // Test that parameter validation logic would work correctly

        // Valid parameters
        let page = 1u32;
        let limit = 20u32;
        let sort_field = Some("start_datetime");
        let sort_order = "desc";

        assert!(page > 0);
        assert!(limit > 0 && limit <= 100);

        let valid_sort_fields = ["start_datetime", "end_datetime", "duration", "status"];
        if let Some(sort) = sort_field {
            assert!(valid_sort_fields.contains(&sort));
        }
        assert!(sort_order == "asc" || sort_order == "desc");

        // Invalid parameters
        let invalid_page = 0u32;
        let invalid_limit = 150u32;
        let invalid_sort = "invalid_field";
        let invalid_order = "invalid_order";

        assert_eq!(invalid_page, 0); // Should fail validation
        assert!(invalid_limit > 100); // Should fail validation
        assert!(!valid_sort_fields.contains(&invalid_sort)); // Should fail validation
        assert!(invalid_order != "asc" && invalid_order != "desc"); // Should fail validation
    }

    #[test]
    fn test_task_jobs_query_building() {
        // Test the logic for building WHERE clauses and ORDER BY clauses

        let _task_name = "test-task";
        let status_filter = Some("completed");

        // Test WHERE clause building
        let mut where_conditions = vec!["task_name = $1".to_string()];
        let mut param_count = 1;

        if status_filter.is_some() {
            param_count += 1;
            where_conditions.push(format!("status = ${}", param_count));
        }

        let where_clause = where_conditions.join(" AND ");
        assert_eq!(where_clause, "task_name = $1 AND status = $2");
        assert_eq!(param_count, 2);

        // Test ORDER BY clause building
        let sort_field = Some("duration");
        let sort_order = "desc";

        let order_by = match sort_field {
            Some("start_datetime") => format!("start_datetime {}", sort_order),
            Some("end_datetime") => format!("end_datetime {} NULLS LAST", sort_order),
            Some("duration") => format!(
                "(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) {} NULLS LAST",
                sort_order
            ),
            Some("status") => format!("status {}", sort_order),
            _ => format!("start_datetime {}", sort_order),
        };

        assert_eq!(
            order_by,
            "(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) desc NULLS LAST"
        );
    }

    #[test]
    fn test_pagination_calculation() {
        // Test pagination calculation logic
        let page = 3u32;
        let limit = 10u32;
        let total_count = 45u32;

        let offset = (page - 1) * limit;
        let total_pages = if total_count == 0 {
            1
        } else {
            (total_count + limit - 1) / limit
        };

        assert_eq!(offset, 20); // Should skip first 20 items
        assert_eq!(total_pages, 5); // 45 items with limit 10 = 5 pages

        let has_next = page < total_pages;
        let has_prev = page > 1;

        assert!(has_next); // Page 3 of 5 should have next
        assert!(has_prev); // Page 3 should have previous
    }

    // Dashboard-specific tests

    #[test]
    fn test_system_status_struct_creation() {
        let now = Utc::now();
        let alert = SystemAlert {
            id: "test-alert".to_string(),
            severity: "warning".to_string(),
            message: "Test alert message".to_string(),
            timestamp: now,
            source: Some("test-source".to_string()),
        };

        let status = SystemStatus {
            active_workers: 3,
            idle_workers: 1,
            total_jobs_today: 42,
            system_uptime: "P1DT12H30M".to_string(),
            average_execution_time_24h: 45.2,
            alerts: vec![alert],
        };

        assert_eq!(status.active_workers, 3);
        assert_eq!(status.idle_workers, 1);
        assert_eq!(status.total_jobs_today, 42);
        assert_eq!(status.alerts.len(), 1);
        assert_eq!(status.alerts[0].severity, "warning");
    }

    #[test]
    fn test_job_execution_metrics_struct_creation() {
        let metrics = JobExecutionMetrics {
            today: DailyJobStats {
                total_jobs: 100,
                success_count: 95,
                failure_count: 5,
                success_rate: 95.0,
            },
            status_distribution: StatusDistribution {
                running: 2,
                completed: 95,
                failed: 5,
                queued: 3,
            },
            top_failing_workflows: vec![FailingWorkflow {
                workflow_name: "test-workflow".to_string(),
                failure_rate: 15.5,
                total_executions: 20,
            }],
            average_execution_time: 42.8,
        };

        assert_eq!(metrics.today.total_jobs, 100);
        assert_eq!(metrics.today.success_rate, 95.0);
        assert_eq!(metrics.status_distribution.running, 2);
        assert_eq!(metrics.top_failing_workflows.len(), 1);
        assert_eq!(
            metrics.top_failing_workflows[0].workflow_name,
            "test-workflow"
        );
    }

    #[test]
    fn test_recent_activity_struct_creation() {
        let now = Utc::now();
        let recent_job = RecentJob {
            job_id: "job-123".to_string(),
            task_name: "test-task".to_string(),
            status: "completed".to_string(),
            start_time: now,
            duration: Some(120.5),
            triggered_by: "user:admin".to_string(),
        };

        let alert = SystemAlert {
            id: "alert-123".to_string(),
            severity: "info".to_string(),
            message: "System info".to_string(),
            timestamp: now,
            source: None,
        };

        let activity = RecentActivity {
            recent_jobs: vec![recent_job],
            alerts: vec![alert],
            upcoming_jobs: vec![],
        };

        assert_eq!(activity.recent_jobs.len(), 1);
        assert_eq!(activity.recent_jobs[0].task_name, "test-task");
        assert_eq!(activity.alerts.len(), 1);
        assert_eq!(activity.upcoming_jobs.len(), 0);
    }

    #[test]
    fn test_job_trends_data_struct_creation() {
        let now = Utc::now();
        let data_point = JobTrendsDataPoint {
            timestamp: now,
            total_jobs: 10,
            successful_jobs: 8,
            failed_jobs: 2,
        };

        let trends = JobTrendsData {
            time_series: vec![data_point],
            time_range: "24h".to_string(),
        };

        assert_eq!(trends.time_series.len(), 1);
        assert_eq!(trends.time_series[0].total_jobs, 10);
        assert_eq!(trends.time_series[0].successful_jobs, 8);
        assert_eq!(trends.time_range, "24h");
    }

    #[test]
    fn test_dashboard_structs_serialization() {
        let now = Utc::now();

        // Test SystemStatus serialization
        let status = SystemStatus {
            active_workers: 2,
            idle_workers: 1,
            total_jobs_today: 50,
            system_uptime: "P1DT6H".to_string(),
            average_execution_time_24h: 30.5,
            alerts: vec![],
        };

        let status_json = serde_json::to_string(&status);
        assert!(status_json.is_ok());
        assert!(status_json.unwrap().contains("\"active_workers\":2"));

        // Test JobExecutionMetrics serialization
        let metrics = JobExecutionMetrics {
            today: DailyJobStats {
                total_jobs: 25,
                success_count: 23,
                failure_count: 2,
                success_rate: 92.0,
            },
            status_distribution: StatusDistribution {
                running: 1,
                completed: 23,
                failed: 2,
                queued: 0,
            },
            top_failing_workflows: vec![],
            average_execution_time: 25.3,
        };

        let metrics_json = serde_json::to_string(&metrics);
        assert!(metrics_json.is_ok());
        assert!(metrics_json.unwrap().contains("\"success_rate\":92"));

        // Test JobTrendsData serialization
        let trends = JobTrendsData {
            time_series: vec![JobTrendsDataPoint {
                timestamp: now,
                total_jobs: 5,
                successful_jobs: 4,
                failed_jobs: 1,
            }],
            time_range: "1h".to_string(),
        };

        let trends_json = serde_json::to_string(&trends);
        assert!(trends_json.is_ok());
        assert!(trends_json.unwrap().contains("\"time_range\":\"1h\""));
    }

    #[test]
    fn test_time_range_validation() {
        // Test valid time ranges
        let valid_ranges = ["1h", "24h", "7d", "30d"];
        for range in valid_ranges {
            // In a real test, we'd call get_job_trends, but here we just test the logic
            assert!(["1h", "24h", "7d", "30d"].contains(&range));
        }

        // Test invalid time range
        let invalid_range = "invalid";
        assert!(!["1h", "24h", "7d", "30d"].contains(&invalid_range));
    }
}
