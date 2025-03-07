use std::collections::VecDeque;
use std::sync::Arc;
use anyhow::{bail, Error, anyhow};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio::sync::mpsc::Sender;
use tokio::task::JoinHandle;
use tracing::{error, info, debug};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub is_stderr: bool,
    pub message: String,
}


pub struct LogCollector {
    client: Client,
    url: String,
    buffer: VecDeque<LogEntry>,
    buffer_size: usize,
}

impl LogCollector {
    pub fn new(server: String, job_id: String, worker_id: String, step_name: Option<String>, buffer_size: Option<usize>) -> Self {
        let url = match step_name {
            Some(step) => format!("{}/jobs/{}/steps/{}/logs?worker_id={}", server, job_id, step, worker_id),
            None => format!("{}/jobs/{}/logs?worker_id={}", server, job_id, worker_id),
        };
        let buffer_size = buffer_size.unwrap_or(10);
        LogCollector {
            client: Client::new(),
            url,
            buffer: VecDeque::with_capacity(buffer_size),
            buffer_size,
        }
    }

    pub async fn log(&mut self, timestamp: DateTime<Utc>, is_stderr: bool, message: String) -> Result<(), Error> {
        let entry = LogEntry { timestamp, is_stderr, message };
        self.buffer.push_back(entry);
        if self.buffer.len() >= self.buffer_size {
            self.send_logs().await?;
            self.buffer.clear();
        }
        Ok(())
    }

    async fn send_logs(&self) -> Result<(), Error> {
        let logs: Vec<LogEntry> = self.buffer.iter().cloned().collect();
        let response = self.client.post(&self.url)
            .json(&logs)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("Sent {} logs to {}", logs.len(), self.url);
                    Ok(())
                } else {
                    let status = resp.status();
                    let body = resp.text().await.unwrap_or_else(|_| "No response body".to_string());
                    error!("Failed to send logs to {}: {} - {}", self.url, status, body);
                    Err(anyhow!("Failed to send logs: {} - {}", status, body))
                }
            }
            Err(e) => {
                error!("Failed to send logs to {}: {}", self.url, e);
                Err(anyhow!("Failed to send logs: {}", e))
            }
        }
    }

    pub async fn flush(&mut self) -> Result<(), Error> {
        if !self.buffer.is_empty() {
            debug!("Flushing {} remaining logs for {}", self.buffer.len(), self.url);
            self.send_logs().await?;
            self.buffer.clear();
        }
        Ok(())
    }
}

impl Drop for LogCollector {
    fn drop(&mut self) {
        // No automatic flush; handled explicitly
    }
}