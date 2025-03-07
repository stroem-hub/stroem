use std::path::{Path, PathBuf};
// common/src/lib.rs
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::io::AsyncBufReadExt;
use tokio::process::{Command};
use std::process::Stdio;
use tokio::select;
use tracing::{error, info};
use reqwest::Client;
use anyhow::{Error, bail, anyhow};
use std::collections::VecDeque;
use tokio::process::Command as TokioCommand;
use tokio::sync::mpsc::{self, Sender};
use serde_json::Value;
use regex::Regex;

pub mod workspace;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub task: Option<String>,
    pub action: Option<String>,
    pub input: Option<serde_json::Value>,
    pub uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub is_stderr: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobResult {
    // pub worker_id: String, // --
    // pub job_id: String, // --
    pub exit_success: bool,
    // pub logs: Vec<LogEntry>, // --
    pub start_datetime: DateTime<Utc>,
    pub end_datetime: DateTime<Utc>,
    // #[serde(default)]
    // pub task: Option<String>, // --
    // #[serde(default)]
    // pub action: Option<String>, // --
    #[serde(default)]
    pub input: Option<serde_json::Value>,
    #[serde(default)]
    pub output: Option<serde_json::Value>,
    #[serde(default)]
    pub revision: Option<String>,  // New field
}

lazy_static::lazy_static! {
    static ref ANSI_REGEX: Regex = Regex::new(r"\x1B\[[0-?]*[ -/]*[@-~]").unwrap();
}

fn strip_ansi(input: &str) -> String {
    ANSI_REGEX.replace_all(input, "").to_string()
}

pub async fn run(cmd: &str, args: Option<Vec<String>>, cwd: Option<&PathBuf>, log_collector: &LogCollector) -> Result<(bool, Option<Value>), Error> {
    let mut command = TokioCommand::new(cmd);
    if let Some(args) = args {
        command.args(args);
    }
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());

    let mut child = command.spawn()
        .map_err(|e| anyhow!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    let log_collector_stdout = log_collector.clone();
    let log_collector_stderr = log_collector.clone();

    let (tx, mut rx) = mpsc::channel::<String>(100); // Channel for collecting OUTPUT: lines
    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        while let Some(line) = stdout_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            log_collector_stdout.log(Utc::now(), false, clean_line.clone()).await.unwrap_or_else(|e| error!("Failed to log stdout: {}", e));
            if line.starts_with("OUTPUT:") {
                tx.send(line).await.unwrap_or_else(|e| error!("Failed to send output line: {}", e));
            }
        }
    });

    tokio::spawn(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        while let Some(line) = stderr_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            log_collector_stderr.log(Utc::now(), true, clean_line).await.unwrap_or_else(|e| error!("Failed to log stderr: {}", e));
        }
    });

    let status = child.wait().await?;
    let mut output_lines = Vec::new();
    while let Some(line) = rx.recv().await {
        output_lines.push(line.strip_prefix("OUTPUT:").unwrap().trim().to_string());
    }
    let output = if output_lines.is_empty() {
        None
    } else {
        let joined_output = output_lines.join("\n");
        match serde_json::from_str(&joined_output) {
            Ok(json) => Some(json),
            Err(_) => Some(Value::String(joined_output)),
        }
    };

    Ok((status.success(), output))
}

pub async fn send_result(client: &Client, server: &str, result: &JobResult) -> Result<(), Error> {
    let url = format!("{}/jobs/results", server);
    client.post(&url)
        .json(result)
        .send()
        .await?;
        //.map_err(|e| format!("Failed to send result: {}", e))?;
    Ok(())
}

#[derive(Clone)]
pub struct LogCollector {
    sender: Sender<LogEntry>,
}

impl LogCollector {
    pub fn new(server: String, job_id: String, worker_id: String, step_name: Option<String>, buffer_size: Option<usize>) -> Self {
        let (sender, mut receiver) = mpsc::channel::<LogEntry>(buffer_size.unwrap_or(10) * 2); // Double buffer for channel
        let client = Client::new();
        let buffer_size = buffer_size.unwrap_or(10);

        // Spawn a background task to handle buffering and sending
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

            // Flush remaining logs on shutdown
            if !buffer.is_empty() {
                if let Err(e) = Self::send_logs(&client, &url, &buffer).await {
                    error!("Failed to flush remaining logs: {}", e);
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
            .await?;

        if response.status().is_success() {
            info!("Sent {} logs to {}", logs.len(), url);
        } else {
            let msg = format!("Failed to send logs to {}: {}, {}", url, response.status(), response.text().await?);
            error!(msg);
            bail!(msg);
        }
        Ok(())
    }
}

impl Drop for LogCollector {
    fn drop(&mut self) {
        // Channel closes automatically, triggering flush in the background task
    }
}