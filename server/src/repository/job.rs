use deadpool_postgres::Pool;
use std::path::{Path, PathBuf};
use tracing::{info, error, debug};
use chrono::{DateTime, Utc};
use serde_json::Value;
use anyhow::{Error, anyhow, bail};
use tokio::fs::{File, OpenOptions};
use tokio::io::{AsyncWriteExt, BufReader, AsyncBufReadExt};
use std::collections::HashMap;
use fs2::FileExt;
use tokio_stream::{self, StreamExt, wrappers::LinesStream};
use futures::Stream;

use stroem_common::{Job, JobResult, log_collector::LogEntry};

#[derive(Clone)]
pub struct JobRepository {
    pool: Pool,
}

impl JobRepository {
    pub fn new(pool: Pool) -> Self {
        Self { pool }
    }

    pub async fn enqueue_job(&self, job: &Job, source_type: &str, source_id: Option<&str>) -> Result<String, Error> {
        let client = self.pool.get().await?;
        let uuid = job.uuid.clone().unwrap_or_else(|| uuid::Uuid::new_v4().to_string()); // Fallback if not set
        client.execute(
            "INSERT INTO job (job_id, task_name, action_name, input, queued, status, source_type, source_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            &[&uuid, &job.task, &job.action, &job.input, &Utc::now(), &"queued", &source_type, &source_id],
        ).await?;
        Ok(uuid)
    }

    pub async fn get_next_job(&self, worker_id: &str) -> Result<Option<Job>, Error> {
        let client = self.pool.get().await?;

        // Atomically select and update the next job
        let row = client.query_opt(
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
            &[&worker_id],
        ).await?;

        if let Some(row) = row {
            let job_id: String = row.get("job_id");
            let job = Job {
                uuid: Some(job_id.clone()),
                task: row.get("task_name"),
                action: row.get("action_name"),
                input: row.get("input"),
            };
            debug!("Assigned job {} to worker {}", job_id, worker_id);
            return Ok(Some(job))
        }
        debug!("No jobs available for worker {}", worker_id);
        Ok(None)
    }

    pub async fn get_jobs(&self) -> Result<(), Error> {
        let client = self.pool.get().await?;
        let row = client.query_opt(
            "SELECT
                        job_id, task_name, action_name, input, output,
                        status, source_type, source_id, start_datetime, end_datetime - start_datetime as duration
                      FROM job
                      ORDER BY start_datetime DESC
                      LIMIT 20
            ", &[],
        ).await?;
        Ok(())
    }

    pub async fn update_start_time(&self, job_id: &str, worker_id: &str, start_time: DateTime<Utc>, input: Option<Value>) -> Result<(), Error> {
        let client = self.pool.get().await?;
        let rows_affected = client.execute(
            "UPDATE job
             SET start_datetime = $1, input = $2
             WHERE job_id = $3 AND worker_id = $4 AND status = 'running'",
            &[
                &start_time,
                &input,
                &job_id,
                &worker_id
            ]
        ).await?;

        if rows_affected == 0 {
            let msg = format!("Failed to update start time for job_id {}: not found or not running for worker {}", job_id, worker_id);
            error!(msg);
            bail!(msg);
        }

        info!("Updated start time for job_id {} by worker {}", job_id, worker_id);
        Ok(())
    }

    pub async fn update_step_start_time(&self, job_id: &str, step_name: &str, worker_id: &str, start_time: DateTime<Utc>, input: Option<Value>) -> Result<(), Error> {
        let client = self.pool.get().await?;
        let rows_affected = client.execute(
            "INSERT INTO job_step (job_id, step_name, start_datetime, input)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (job_id, step_name)
             DO UPDATE SET start_datetime = NOW()
             WHERE job_step.job_id = $1 AND job_step.step_name=$2", // AND EXISTS ( SELECT 1 FROM job WHERE job_id = $1 AND worker_id = $5 AND status = 'running' )
            &[&job_id, &step_name, &start_time, &input]
        ).await?;

        if rows_affected == 0 {
            let msg = format!("Failed to update step start time for job_id {}, step_name {}: job not found or not running for worker {}", job_id, step_name, worker_id);
            error!(msg);
            bail!(msg);
        }

        info!("Updated start time for job_id {}, step_name {} by worker {}", job_id, step_name, worker_id);
        Ok(())
    }

    pub async fn update_step_result(&self, job_id: &str, step_name: &str, result: &JobResult) -> Result<(), anyhow::Error> {
        let client = self.pool.get().await?;
        let rows_affected = client.execute(
            "UPDATE job_step
             SET start_datetime = $1, end_datetime = $2, output = $3, success = $4
             WHERE job_id = $5 AND step_name = $6 ", //AND EXISTS (SELECT 1 FROM job WHERE job_id = $5 AND status = 'running')",
            &[
                &result.start_datetime,
                &result.end_datetime,
                &result.output,
                &result.exit_success,
                &job_id,
                &step_name,
            ],
        ).await?;

        if rows_affected == 0 {
            let msg = format!("Failed to update step result for job_id {}, step_name {}: step not found or job not running", job_id, step_name);
            error!(msg);
            return Ok(())
            // bail!(msg);
        }

        info!("Updated result for job_id {}, step_name {}", job_id, step_name);
        Ok(())
    }

    pub async fn update_job_result(&self, job_id: &str, result: &JobResult) -> Result<(), anyhow::Error> {
        let client = self.pool.get().await?;
        let rows_affected = client.execute(
            "UPDATE job
             SET start_datetime = $1, end_datetime = $2, output = $3, success = $4, status = $5
             WHERE job_id = $6",
            &[
                &result.start_datetime,
                &result.end_datetime,
                &result.output,
                &result.exit_success,
                &if result.exit_success { "completed" } else { "failed" },
                &job_id,
            ],
        ).await?;

        if rows_affected == 0 {
            let msg = format!("Failed to update job result for job_id {}: not found", &job_id);
            error!(msg);
            bail!(msg);
        }

        info!("Stored job result: job_id={}", &job_id);
        Ok(())
    }
}