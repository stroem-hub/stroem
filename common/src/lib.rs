pub mod workspace;

// common/src/lib.rs
use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Job {
    pub task: Option<String>,
    pub action: Option<String>,
    pub input: Option<serde_json::Value>,
    pub uuid: Option<String>,
}