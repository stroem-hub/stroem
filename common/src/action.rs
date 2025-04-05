pub mod shell;

use std::path::PathBuf;
use std::sync::Arc;
use anyhow::Error;
use async_trait::async_trait;
use serde_json::Value;
use crate::log_collector::LogCollector;

#[async_trait]
pub trait ActionExecutor {
    async fn execute(
        &self,
        action: &Value,
        input: &Option<Value>,
        workspace_path: &PathBuf,
        log_collector: Arc<dyn LogCollector + Send + Sync>,
    ) -> Result<(bool, Option<Value>), Error>;
} 