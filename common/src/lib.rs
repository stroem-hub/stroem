pub mod workspace;

// common/src/lib.rs
use serde::{Serialize, Deserialize};
use chrono::{DateTime, Utc};

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
    pub exit_status: i32,
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
