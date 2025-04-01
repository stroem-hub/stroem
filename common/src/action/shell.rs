use std::path::PathBuf;
use std::sync::Arc;
use anyhow::Error;
use async_trait::async_trait;
use serde_json::Value;
use crate::action::ActionExecutor;
use crate::log_collector::LogCollector;
use crate::run;
use crate::workflows_configuration::Action;

#[derive(Clone)]
pub struct ShellAction;
#[async_trait]
impl ActionExecutor for ShellAction {
    async fn execute(
        &self,
        action: &Value,
        input: &Option<Value>,
        workspace_path: &PathBuf,
        log_collector: Arc<dyn LogCollector + Send + Sync>,
    ) -> Result<(bool, Option<Value>), Error> {
        let cmd = action["cmd"].as_str().unwrap();
        let (exit_success, output) = run("sh", None, Some(cmd.to_string()), Some(&workspace_path), log_collector).await?;

        Ok((exit_success, output))
    }
}