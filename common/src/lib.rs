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
pub mod log_collector;
pub mod parameter_renderer;
use log_collector::{LogCollector, LogEntry};


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub task: Option<String>,
    pub action: Option<String>,
    pub input: Option<serde_json::Value>,
    pub uuid: Option<String>,
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

pub async fn run(cmd: &str, args: Option<Vec<String>>, cwd: Option<&PathBuf>, mut log_collector: LogCollector) -> Result<(bool, Option<Value>), Error> {
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

    // Channel for LogEntry from stdout/stderr to writer
    let (log_tx, mut log_rx) = mpsc::channel::<LogEntry>(100);
    // Channel for OUTPUT: lines
    let (output_tx, mut output_rx) = mpsc::channel::<String>(100);

    // Stdout task
    let log_tx_stdout = log_tx.clone();
    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        while let Some(line) = stdout_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            let entry = LogEntry {
                timestamp: Utc::now(),
                is_stderr: false,
                message: clean_line,
            };
            log_tx_stdout.send(entry).await.unwrap_or_else(|e| error!("Failed to send stdout log: {}", e));
            if line.starts_with("OUTPUT:") {
                output_tx.send(line).await.unwrap_or_else(|e| error!("Failed to send output line: {}", e));
            }
        }
    });

    // Stderr task
    let log_tx_stderr = log_tx.clone();
    tokio::spawn(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        while let Some(line) = stderr_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            let entry = LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: clean_line,
            };
            log_tx_stderr.send(entry).await.unwrap_or_else(|e| error!("Failed to send stderr log: {}", e));
        }
    });

    // Single writer task to LogCollector
    tokio::spawn(async move {
        while let Some(entry) = log_rx.recv().await {
            log_collector.log(entry.timestamp, entry.is_stderr, entry.message)
                .await
                .unwrap_or_else(|e| error!("Failed to log entry: {}", e));
        }
        // Flush remaining logs when channel closes
        log_collector.flush().await.unwrap_or_else(|e| error!("Failed to flush logs: {}", e));
    });

    let status = child.wait().await?;
    let mut output_lines = Vec::new();
    while let Some(line) = output_rx.recv().await {
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

