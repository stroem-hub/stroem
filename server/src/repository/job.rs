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
}
