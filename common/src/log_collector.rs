use std::collections::VecDeque;
use std::sync::Arc;
use anyhow::{bail, Error, anyhow, Context};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, RwLock};
use tokio::sync::mpsc::Sender;
use tokio::task::JoinHandle;
use tracing::{error, info, debug};
use async_trait::async_trait;
use serde_json::{json, Value};
use crate::JobResult;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub is_stderr: bool,
    pub message: String,
}

#[async_trait]
pub trait LogCollector {
    async fn log(&self, timestamp: DateTime<Utc>, is_stderr: bool, message: String) -> Result<(), Error>;
    async fn flush(&self) -> Result<(), Error>;
    async fn set_step_name(&self, step_name: Option<String>);

    async fn mark_start(&self, start: DateTime<Utc>, input: &Option<Value>) -> Result<(), Error> ;
    async fn store_results(&self, result: JobResult) -> Result<(), Error> ;
}

pub struct LogCollectorServer {
    server: String,
    job_id: String,
    worker_id: String,
    client: Client,
    step_name: Arc<RwLock<Option<String>>>,
    buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    buffer_size: usize,
}

impl LogCollectorServer {
    pub fn new(server: String, job_id: String, worker_id: String, step_name: Option<String>, buffer_size: Option<usize>) -> Self {
        let buffer_size = buffer_size.unwrap_or(10);
        Self {
            server,
            job_id,
            worker_id,
            client: Client::new(),
            step_name: Arc::new(RwLock::new(step_name)),
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(buffer_size))),
            buffer_size,
        }
    }

    async fn send_logs(&self, buffer: &VecDeque<LogEntry>) -> Result<(), Error> {
        let url = self.get_url("logs").await;
        debug!("Sending {} logs to {}", buffer.len(), url);
        let response = self.client.post(&url)
            .json(&buffer)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("Sent {} logs to {}", buffer.len(), url);
                    Ok(())
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_else(|_| "No response body".to_string());
                    error!("Failed to send logs to {}: {} - {}", url, status, body);
                    Err(anyhow!("Failed to send logs: {} - {}", status, body))
                }
            }
            Err(e) => {
                error!("Failed to send logs to {}: {}", url, e);
                Err(anyhow!("Failed to send logs: {}", e))
            }
        }
    }

    async fn get_url(&self, url_type: &str) -> String {
        let step_name_guard = self.step_name.read().await;
        match step_name_guard.as_ref() {
            Some(step) => format!("{}/jobs/{}/steps/{}/{}?worker_id={}", self.server, self.job_id, step, url_type, self.worker_id),
            None => format!("{}/jobs/{}/{}?worker_id={}", self.server, self.job_id, url_type, self.worker_id),
        }
    }

}

#[async_trait]
impl LogCollector for LogCollectorServer {
    async fn log(&self, timestamp: DateTime<Utc>, is_stderr: bool, message: String) -> Result<(), Error> {
        let entry = LogEntry { timestamp, is_stderr, message };
        let mut buffer_guard = self.buffer.write().await;
        buffer_guard.push_back(entry);
        if buffer_guard.len() >= self.buffer_size {
            self.send_logs(&*buffer_guard).await?;
            buffer_guard.clear();
        }
        Ok(())
    }

    async fn flush(&self) -> Result<(), Error> {
        let mut buffer_guard = self.buffer.write().await;
        if !buffer_guard.is_empty() {
            debug!("Flushing {} remaining logs", buffer_guard.len());
            self.send_logs(&*buffer_guard).await?;
            buffer_guard.clear();
        }
        Ok(())
    }


    async fn set_step_name(&self, step_name: Option<String>) {
        let mut step_name_guard = self.step_name.write().await;
        *step_name_guard = step_name;
    }

    async fn mark_start(&self, start: DateTime<Utc>, input: &Option<Value>) -> Result<(), Error> {
        let start_payload = json!({
            "start_datetime": start.to_rfc3339(),
            "input": &input,
        });

        let url = self.get_url("start").await;

        let response = self.client.post(&url)
            .json(&start_payload)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok(())
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_else(|_| "No response body".to_string());
                    error!("Failed to send start mark to {}: {} - {}", url, status, body);
                    Err(anyhow!("Failed to send start mark: {} - {}", status, body))
                }
            }
            Err(e) => {
                error!("Failed to send start mark to {}: {}", url, e);
                Err(anyhow!("Failed to send start mark: {}", e))
            }
        }
    }

    async fn store_results(&self, result: JobResult) -> Result<(), Error>  {
        let url = self.get_url("results").await;
        let response = self.client.post(&url)
            .json(&result)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    Ok(())
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_else(|_| "No response body".to_string());
                    error!("Failed to send results to {}: {} - {}", url, status, body);
                    Err(anyhow!("Failed to send results: {} - {}", status, body))
                }
            }
            Err(e) => {
                error!("Failed to send results to {}: {}", url, e);
                Err(anyhow!("Failed to send results: {}", e))
            }
        }
    }
}

impl Drop for LogCollectorServer {
    fn drop(&mut self) {
        // No automatic flush; handled explicitly
    }
}