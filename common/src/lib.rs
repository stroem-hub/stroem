// common/src/lib.rs
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};
use tokio::io::{AsyncWriteExt, BufReader};
use tokio::io::AsyncBufReadExt;
use tokio::process::{Command};
use std::process::Stdio;
use tokio::select;
use tracing::{error, info};

pub mod workspace;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub task: Option<String>,
    pub action: Option<String>,
    pub input: Option<serde_json::Value>,
    pub uuid: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LogEntry {
    pub timestamp: DateTime<Utc>,
    pub is_stderr: bool,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JobResult {
    pub worker_id: String,
    pub job_id: String,
    pub exit_success: bool,
    pub logs: Vec<LogEntry>,
    pub start_datetime: DateTime<Utc>,
    pub end_datetime: DateTime<Utc>,
    #[serde(default)]
    pub task: Option<String>,
    #[serde(default)]
    pub action: Option<String>,
    #[serde(default)]
    pub input: Option<serde_json::Value>,
    #[serde(default)]
    pub output: Option<serde_json::Value>,
}

pub async fn run(cmd: &str, args: Option<Vec<String>>) -> (Vec<LogEntry>, bool) {
    let mut child = Command::new(cmd);
    if let Some(args) = args {
        child.args(args);
    }
    let mut child = match child.stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn() {
        Ok(child) => child,
        Err(e) => {
            let msg = format!("Failed to spawn command '{}': {}", cmd, e);
            error!(msg);
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: msg,
            }], false);
        }
    };

    let stdout = match child.stdout.take() {
        Some(stdout) => stdout,
        None => {
            let msg = format!("Failed to capture stdout for '{}'", cmd);
            error!(msg);
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: msg,
            }], false);
        }
    };
    let stderr = match child.stderr.take() {
        Some(stderr) => stderr,
        None => {
            let msg = format!("Failed to capture stderr for '{}'", cmd);
            error!(msg);
            return (vec![LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: msg,
            }], false);
        }
    };

    let mut log_entries: Vec<LogEntry> = Vec::new();
    let mut stdout_lines = BufReader::new(stdout).lines();
    let mut stderr_lines = BufReader::new(stderr).lines();
    let mut stdout_done = false;
    let mut stderr_done = false;

    loop {
        if stdout_done && stderr_done {
            break;
        }
        select! {
            line = stdout_lines.next_line(), if !stdout_done => match line {
                Ok(Some(line)) => {
                    log_entries.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: false,
                        message: line,
                    });
                }
                Ok(None) => stdout_done = true,
                Err(e) => {
                    let msg = format!("Error reading stdout: {}", e);
                    error!(msg);
                    log_entries.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: msg,
                    });
                    stdout_done = true;
                }
            },
            line = stderr_lines.next_line(), if !stderr_done => match line {
                Ok(Some(line)) => {
                    log_entries.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: line,
                    });
                }
                Ok(None) => stderr_done = true,
                Err(e) => {
                    let msg = format!("Error reading stderr: {}", e);
                    error!(msg);
                    log_entries.push(LogEntry {
                        timestamp: Utc::now(),
                        is_stderr: true,
                        message: msg,
                    });
                    stderr_done = true;
                }
            },
        }
    }

    let status = match child.wait().await {
        Ok(status) => status.success(),
        Err(e) => {
            let msg = format!("Failed to wait for command '{}': {}", cmd, e);
            error!(msg);
            log_entries.push(LogEntry {
                timestamp: Utc::now(),
                is_stderr: true,
                message: msg,
            });
            false
        }
    };

    (log_entries, status)
}