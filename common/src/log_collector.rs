use std::collections::VecDeque;
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


#[derive(Clone)]
pub struct LogCollector {
    sender: Sender<LogEntry>,
}

impl LogCollector {
    pub fn new(server: String, job_id: String, worker_id: String, step_name: Option<String>, buffer_size: Option<usize>) -> Self {
        let (sender, mut receiver) = mpsc::channel::<LogEntry>(buffer_size.unwrap_or(10) * 2);
        let client = Client::new();
        let buffer_size = buffer_size.unwrap_or(10);

        tokio::spawn(async move {
            let mut buffer = VecDeque::with_capacity(buffer_size);
            let url = match &step_name {
                Some(step) => format!("{}/jobs/{}/steps/{}/logs?worker_id={}", server, job_id, step, worker_id),
                None => format!("{}/jobs/{}/logs?worker_id={}", server, job_id, worker_id),
            };

            while let Some(log) = receiver.recv().await {
                buffer.push_back(log);
                if buffer.len() >= buffer_size {
                    if let Err(e) = Self::send_logs(&client, &url, &buffer).await {
                        error!("Failed to send logs: {}", e);
                    }
                    buffer.clear();
                }
            }

            // Final flush
            if !buffer.is_empty() {
                debug!("Flushing {} remaining logs for {}", buffer.len(), url);
                if let Err(e) = Self::send_logs(&client, &url, &buffer).await {
                    error!("Failed to flush remaining logs: {} - {:?}", e, buffer);
                }
            }
        });

        LogCollector { sender }
    }

    pub async fn log(&self, timestamp: DateTime<Utc>, is_stderr: bool, message: String) -> Result<(), Error> {
        let entry = LogEntry { timestamp, is_stderr, message };
        self.sender.send(entry).await?;
        Ok(())
    }

    async fn send_logs(client: &Client, url: &str, buffer: &VecDeque<LogEntry>) -> Result<(), Error> {
        let logs: Vec<LogEntry> = buffer.iter().cloned().collect();
        let response = client.post(url)
            .json(&logs)
            .send()
            .await;

        match response {
            Ok(resp) => {
                if resp.status().is_success() {
                    info!("Sent {} logs to {}", logs.len(), url);
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

    pub async fn flush(&self) -> Result<(), Error> {
        // Drop the sender to close the channel and trigger flush
        drop(self.sender.clone());
        // Give the background task a moment to complete
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        Ok(())
    }
}

impl Drop for LogCollector {
    fn drop(&mut self) {
        // No automatic flush; handled explicitly
    }
}