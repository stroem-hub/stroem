use std::collections::VecDeque;
use std::sync::Arc;
use std::time::Duration;
use anyhow::{Error, anyhow};
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tokio::sync::{mpsc, RwLock};
use tokio::task::JoinHandle;
use tracing::{error, info, debug};
use async_trait::async_trait;
use serde_json::{json, Value};
use tokio::time::sleep;
use crate::JobResult;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub is_stderr: bool,
    pub message: String,
}

#[async_trait]
pub trait LogCollector {
    async fn log(&self, entry: LogEntry) -> Result<(), Error>;
    async fn flush(&self) -> Result<(), Error>;
    async fn set_step_name(&self, step_name: Option<String>);

    async fn mark_start(&self, start: DateTime<Utc>, input: &Option<Value>) -> Result<(), Error> ;
    async fn store_results(&self, result: JobResult) -> Result<(), Error> ;
}

#[derive(Clone)]
pub struct LogCollectorServer {
    server: String,
    job_id: String,
    worker_id: String,
    client: Client,
    step_name: Arc<RwLock<Option<String>>>,
    buffer: Arc<RwLock<VecDeque<LogEntry>>>,
    buffer_size: usize,
    sender: mpsc::Sender<LogEntry>,
    handle: Arc<Option<JoinHandle<()>>>,
}

impl LogCollectorServer {
    pub fn new(server: String, job_id: String, worker_id: String, step_name: Option<String>, buffer_size: Option<usize>) -> Self {
        let buffer_size = buffer_size.unwrap_or(10);
        let (sender, mut receiver) = mpsc::channel::<LogEntry>(100);


        let mut s = Self {
            server,
            job_id,
            worker_id,
            client: Client::new(),
            step_name: Arc::new(RwLock::new(step_name)),
            buffer: Arc::new(RwLock::new(VecDeque::with_capacity(buffer_size))),
            buffer_size,
            sender,
            handle: Arc::new(None)
        };

        let lc = s.clone();

        let handle = tokio::spawn(async move {
            let flush_interval = Duration::from_secs(5); // X seconds, e.g., 5
            loop {
                tokio::select! {
                    entry = receiver.recv() => {
                        match entry {
                            Some(entry) => {
                                let mut buffer_guard = lc.buffer.write().await;
                                buffer_guard.push_back(entry);
                                if buffer_guard.len() >= lc.buffer_size {
                                   let _ = lc.send_logs(&*buffer_guard).await;
                                  buffer_guard.clear();
                                }
                            }
                            None => break,
                        }

                    }
                    _ = sleep(flush_interval) => {
                        let  _ = lc.flush().await;
                    }
                }
            }
            lc.flush().await.ok();
        });

        s.handle = Arc::new(Some(handle));

        s
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

impl Drop for LogCollectorServer {
    fn drop(&mut self) {
        if let Some(handle) = self.handle.as_ref() {
            handle.abort();
        }
    }
}

#[async_trait]
impl LogCollector for LogCollectorServer {

    async fn log(&self, entry: LogEntry) -> Result<(), Error> {
        // let entry = LogEntry { timestamp, is_stderr, message };
        self.sender.send(entry).await?;
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


pub struct LogCollectorConsole {
    step_name: Arc<RwLock<Option<String>>>,
}

impl LogCollectorConsole {
    pub fn new(step_name: Option<String>) -> Self {
        Self {
            step_name: Arc::new(RwLock::new(step_name)),
        }
    }
}

#[async_trait]
impl LogCollector for LogCollectorConsole {

    async fn log(&self, entry: LogEntry) -> Result<(), Error> {
        println!("{} {}", entry.timestamp.format("%H:%M"), entry.message);
        Ok(())
    }

    async fn flush(&self) -> Result<(), Error> {
        Ok(())
    }

    async fn set_step_name(&self, step_name: Option<String>) {
        let mut step_name_guard = self.step_name.write().await;
        *step_name_guard = step_name;
    }

    async fn mark_start(&self, _start: DateTime<Utc>, input: &Option<Value>) -> Result<(), Error> {
        let step_name_guard = self.step_name.read().await;
        if let Some(step_name) = step_name_guard.as_ref() {
            println!("====== Step: {} ======", step_name);
        }
        println!("---- Input ----");
        println!("{}", serde_json::to_string_pretty(&input.as_ref().unwrap_or(&Value::Null)).unwrap());
        println!("---------------");
        Ok(())
    }

    async fn store_results(&self, result: JobResult) -> Result<(), Error> {
        println!("---- Output ----");
        println!("{}", serde_json::to_string_pretty(&result.output.as_ref().unwrap_or(&Value::Null)).unwrap());
        println!("---------------");
        println!("===================");
        Ok(())
    }
}