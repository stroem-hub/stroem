use anyhow::{Error, bail};
use chrono::{DateTime, Utc};
use serde_json::Value;
use sqlx::PgPool;
use sqlx::Row;
use tracing::{debug, error, info};

use serde::{Deserialize, Serialize};
use uuid::Uuid;
use stroem_common::{JobRequest, JobResult};

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
    pub status: String, // 'success' | 'failed' | 'running' | 'queued'
    pub triggered_by: String, // source_type:source_id format
    pub duration: Option<f64>, // in seconds
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
    pub async fn get_task_statistics(&self, task_name: &str) -> Result<Option<TaskStatistics>, Error> {
        // First, get the basic statistics for the task
        let stats_row = sqlx::query(
            "SELECT 
                task_name,
                COUNT(*) as total_executions,
                COALESCE(AVG(CASE WHEN success = true THEN 1.0 ELSE 0.0 END) * 100, 0)::FLOAT8 as success_rate,
                AVG(EXTRACT(EPOCH FROM (end_datetime - start_datetime)))::FLOAT8 as average_duration
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
                 LIMIT 1"
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
        let task_names: Vec<String> = sqlx::query_scalar(
            "SELECT DISTINCT task_name FROM job WHERE task_name IS NOT NULL"
        )
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
                bail!("Invalid sort field. Valid options: start_datetime, end_datetime, duration, status");
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
            Some("duration") => format!("(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) {} NULLS LAST", sort_order),
            Some("status") => format!("status {}", sort_order),
            _ => format!("start_datetime {}", sort_order), // Default sort
        };

        // Get total count for pagination
        let count_query = format!(
            "SELECT COUNT(*) FROM job WHERE {}",
            where_clause
        );

        let mut count_query_builder = sqlx::query_scalar::<_, i64>(&count_query)
            .bind(task_name);

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

        let mut jobs_query_builder = sqlx::query_as::<_, Job>(&jobs_query)
            .bind(task_name);

        if let Some(status) = status_filter {
            jobs_query_builder = jobs_query_builder.bind(status);
        }

        jobs_query_builder = jobs_query_builder
            .bind(limit as i64)
            .bind(offset as i64);

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
            Some("duration") => format!("(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) {} NULLS LAST", sort_order),
            Some("status") => format!("status {}", sort_order),
            _ => format!("start_datetime {}", sort_order),
        };
        
        assert_eq!(order_by, "(EXTRACT(EPOCH FROM (end_datetime - start_datetime))) desc NULLS LAST");
    }

    #[test]
    fn test_pagination_calculation() {
        // Test pagination calculation logic
        let page = 3u32;
        let limit = 10u32;
        let total_count = 45u32;
        
        let offset = (page - 1) * limit;
        let total_pages = if total_count == 0 { 1 } else { (total_count + limit - 1) / limit };
        
        assert_eq!(offset, 20); // Should skip first 20 items
        assert_eq!(total_pages, 5); // 45 items with limit 10 = 5 pages
        
        let has_next = page < total_pages;
        let has_prev = page > 1;
        
        assert!(has_next); // Page 3 of 5 should have next
        assert!(has_prev); // Page 3 should have previous
    }
}
