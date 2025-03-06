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

use common::{Job, JobResult, LogEntry};
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

    pub async fn update_start_time(&self, job_id: &str, worker_id: &str, start_time: DateTime<Utc>, input: Option<Value>) -> Result<(), Error> {
        let client = self.pool.get().await?;
        let rows_affected = client.execute(
            "UPDATE job
             SET start_datetime = $1, input = $2
             WHERE job_id = $3 AND worker_id = $4 AND status = 'running'",
            &[
                &start_time,
                &input,
                &job_id, &worker_id
            ],
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
            "INSERT INTO job_steps (job_id, step_name, start_datetime, input)
             VALUES ($1, $2, $4, $5)
             ON CONFLICT (job_id, step_name)
             DO UPDATE SET start_datetime = NOW()
             WHERE job_steps.job_id = $1 AND EXISTS (
                 SELECT 1 FROM job WHERE job_id = $1 AND worker_id = $3 AND status = 'running'
             )",
            &[&job_id, &step_name, &worker_id, &start_time, &input],
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
            "UPDATE job_steps
             SET start_datetime = $1, end_datetime = $2, output = $3, success = $4
             WHERE job_id = $5 AND step_name = $6 AND EXISTS (
                 SELECT 1 FROM job WHERE job_id = $5 AND status = 'running'
             )",
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
            bail!(msg);
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

pub struct LogRepository {
    logs_dir: PathBuf,
}

impl LogRepository {
    pub fn new(logs_dir: PathBuf) -> Self {
        Self { logs_dir }
    }

    pub async fn save_logs(&self, job_id: &str, step_name: Option<&str>, logs: Vec<LogEntry>) -> Result<(), anyhow::Error> {
        let file_path = self.get_log_file_path(job_id, step_name);
        std::fs::create_dir_all(file_path.parent().unwrap())?;

        // Open file with append mode
        let file = OpenOptions::new()
            .create(true)
            .append(true)
            .open(&file_path)
            .await?;

        // Convert Tokio File to std::fs::File for locking (fs2 operates on std)
        let std_file = file
            .try_into_std().unwrap();

        // Acquire an exclusive lock (blocking)
        std_file
            .lock_exclusive()
            .map_err(|e| anyhow!("Failed to lock log file {}: {}", file_path.display(), e))?;

        // Convert back to Tokio File for async writing
        let mut file = File::from_std(std_file);
        let mut writer = tokio::io::BufWriter::new(&mut file);

        for log in &logs {
            let line = serde_json::to_string(&log)? + "\n";
            writer.write_all(line.as_bytes()).await?;
        }
        writer.flush().await?;

        // Lock is released when std_file is dropped (end of scope)
        info!("Saved {} logs for job_id: {}, step_name: {:?}", logs.len(), job_id, step_name);
        Ok(())
    }

    pub async fn get_logs(&self, job_id: &str, step_name: Option<&str>) -> Result<Box<dyn Stream<Item = Result<LogEntry, anyhow::Error>> + Send + Unpin>, anyhow::Error> {
        let file_path = self.get_log_file_path(job_id, step_name);

        if !file_path.exists() {
            debug!("No logs found for job_id: {}, step_name: {:?}", job_id, step_name);
            return Ok(Box::new(tokio_stream::empty()));
        }

        let file = File::open(&file_path).await?;
        let reader = BufReader::new(file);
        let lines = LinesStream::new(reader.lines());

        let stream = lines.map(|line| {
            line.map_err(anyhow::Error::from)
                .and_then(|l| serde_json::from_str(&l).map_err(anyhow::Error::from))
        });

        Ok(Box::new(stream))
    }

    fn get_log_file_path(&self, job_id: &str, step_name: Option<&str>) -> PathBuf {
        match step_name {
            Some(step) => self.logs_dir.join(format!("{}_{}.jsonl", job_id, step)),
            None => self.logs_dir.join(format!("{}.jsonl", job_id)),
        }
    }
}