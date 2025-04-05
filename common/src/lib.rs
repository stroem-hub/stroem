use std::path::{PathBuf};
// common/src/lib.rs
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::io::AsyncBufReadExt;
use std::process::Stdio;
use tracing::{error};
use anyhow::{anyhow, Error};
use tokio::process::Command as TokioCommand;
use tokio::sync::mpsc::{self};
use serde_json::Value;
use regex::Regex;
use std::io;
use std::sync::Arc;
use tracing_subscriber::{self, filter::LevelFilter, fmt, prelude::*};

pub mod log_collector;
pub mod parameter_renderer;
pub mod dag_walker;
pub mod workflows_configuration;
pub mod workspace_client;
pub mod runner;
mod action;

use log_collector::{LogCollector, LogEntry};


#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobRequest {
    pub task: Option<String>,
    pub action: Option<String>,
    pub input: Option<serde_json::Value>,
    pub uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobResult {
    // pub worker_id: String, // --
    // pub job_id: String, // --
    pub success: bool,
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

pub async fn run(cmd: &str, args: Option<Vec<String>>, stdin_content: Option<String>, cwd: Option<&PathBuf>, log_collector: Arc<dyn LogCollector + Send + Sync>) -> Result<(bool, Option<Value>), Error> {
    let mut command = TokioCommand::new(cmd);
    if let Some(args) = args {
        command.args(args);
    }
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }
    command.stdout(Stdio::piped());
    command.stderr(Stdio::piped());
    if stdin_content.is_some() {
        command.stdin(Stdio::piped());
    }

    let mut child = command.spawn()
        .map_err(|e| anyhow!("Failed to spawn command: {}", e))?;

    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    if stdin_content.is_some() {
        let mut stdin = child.stdin.take().unwrap();

        stdin.write(stdin_content.unwrap().as_ref()).await?;
        stdin.flush().await?;
        stdin.shutdown().await?;
        drop(stdin);
    }


    // Channel for LogEntry from stdout/stderr to writer
    // let (log_tx, mut log_rx) = mpsc::channel::<LogEntry>(100);
    // Channel for OUTPUT: lines
    let (output_tx, mut output_rx) = mpsc::channel::<String>(100);

    // Stdout task
    let lc_stdout = log_collector.clone();
    tokio::spawn(async move {
        let mut stdout_reader = BufReader::new(stdout).lines();
        while let Some(line) = stdout_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            let entry = LogEntry {
                timestamp: Utc::now(),
                is_stderr: false,
                message: clean_line,
            };
            lc_stdout.log(entry).await.ok();
            // log_tx_stdout.send(entry).await.unwrap_or_else(|e| error!("Failed to send stdout log: {}", e));
            if line.starts_with("OUTPUT:") {
                output_tx.send(line).await.unwrap_or_else(|e| error!("Failed to send output line: {}", e));
            }
        }
    });

    // Stderr task
    let lc_stderr = log_collector.clone();
    tokio::spawn(async move {
        let mut stderr_reader = BufReader::new(stderr).lines();
        while let Some(line) = stderr_reader.next_line().await.unwrap_or(None) {
            let clean_line = strip_ansi(&line);
            let entry = LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: clean_line,
            };
            lc_stderr.log(entry).await.ok();
            // log_tx_stderr.send(entry).await.unwrap_or_else(|e| error!("Failed to send stderr log: {}", e));
        }
    });

    let status = child.wait().await?;
    log_collector.flush().await?;
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


pub fn init_tracing(verbose: bool) {
    // Configure tracing with split output
    let stdout_writer = io::stdout; // For INFO and below
    let stderr_writer = io::stderr; // For WARN and above

    let log_level = if verbose { tracing::Level::TRACE } else { tracing::Level::INFO };

    // Create a layer that writes ERROR and WARN to stderr
    let stderr_layer = fmt::layer()
        .with_writer(stderr_writer)
        .with_filter(LevelFilter::WARN); // Includes WARN and ERROR

    // Create a layer that writes INFO, DEBUG, TRACE to stdout
    let stdout_layer = fmt::layer()
        .with_writer(stdout_writer)
        .with_filter(LevelFilter::from_level(log_level)); // Convert Level to LevelFilter

    // Combine layers into the subscriber
    tracing_subscriber::registry()
        .with(stderr_layer)
        .with(stdout_layer)
        .init();
}