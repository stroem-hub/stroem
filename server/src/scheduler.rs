// workflow-server/src/scheduler.rs
use stroem_common::JobRequest;
use stroem_common::workflows_configuration::{TriggerType, WorkflowsConfiguration};
use tokio::sync::watch;
use tracing::{info, error, debug};
use cron::Schedule;
use std::str::FromStr;
use tokio::time::{self, Duration};
use std::collections::HashMap;
use chrono::{Utc, DateTime};
use crate::repository::JobRepository;

pub struct Scheduler {
    job_repository: JobRepository,
    task: Option<tokio::task::JoinHandle<()>>,
    cancel_tx: watch::Sender<bool>,
    config_rx: watch::Receiver<Option<WorkflowsConfiguration>>,
}

impl Scheduler {
    fn load_config(
        config: Option<WorkflowsConfiguration>,
        old_schedules: Option<&HashMap<String, (Schedule, JobRequest, Option<DateTime<Utc>>, Option<DateTime<Utc>>)>>,
    ) -> HashMap<String, (Schedule, JobRequest, Option<DateTime<Utc>>, Option<DateTime<Utc>>)> {
        let mut schedules = HashMap::new();
        let Some(config) = config else { return schedules };

        if let Some(triggers) = &config.triggers {
            for (trigger_name, trigger) in triggers.iter() {
                if !trigger.enabled.unwrap_or(true) {
                    continue;
                }

                match &trigger.trigger_type {
                    TriggerType::Scheduler { cron } => {
                        match Schedule::from_str(&cron) {
                            Ok(schedule) => {
                                let job = JobRequest {
                                    task: Some(trigger.task.clone()),
                                    action: None,
                                    input: trigger.input.clone()
                                        .map(|inputs| {
                                            let mut map = serde_json::Map::new();
                                            for (k, v) in inputs {
                                                map.insert(k, serde_json::Value::String(v));
                                            }
                                            serde_json::Value::Object(map)
                                        }),
                                    uuid: None,
                                };
                                // Use last_run from old_schedules if available, otherwise None
                                let last_run = old_schedules
                                    .and_then(|old| old.get(trigger_name))
                                    .and_then(|(_, _, last, _)| *last);
                                info!("Added trigger '{}' to scheduler: {}", trigger_name, &cron);
                                schedules.insert(trigger_name.clone(), (schedule, job, last_run, None));
                            }
                            Err(e) => error!("Invalid cron expression for trigger '{}': {}", trigger_name, e),
                        }

                    }
                }
            }
        }
        schedules
    }

    pub fn new(job_repository: JobRepository, config_rx: watch::Receiver<Option<WorkflowsConfiguration>>) -> Self {
        let (cancel_tx, _) = watch::channel(false);
        Self {
            job_repository,
            task: None,
            cancel_tx,
            config_rx,
        }
    }

    pub async fn run(&mut self) {
        if self.task.is_some() {
            info!("Scheduler already running");
            return;
        }

        let mut cancel_rx = self.cancel_tx.subscribe();
        let mut config_rx = self.config_rx.clone();
        let job_repo = self.job_repository.clone();

        let task = tokio::spawn(async move {
            let mut schedules = Self::load_config(config_rx.borrow().clone(), None);
            loop {
                let now = Utc::now();
                let mut next_wakeup = None;

                for (trigger_name, (schedule, job, last_run, next_run)) in &mut schedules {
                    debug!("Processing trigger '{}'", trigger_name);
                    if next_run.is_none() {
                        *next_run = schedule.after(&last_run.unwrap_or(now)).next();
                    }

                    if let Some(next_time) = *next_run {
                        if now >= next_time {
                            let job = JobRequest {
                                task: job.task.clone(),
                                action: None,
                                input: job.input.clone(),
                                uuid: None,
                            };
                            if let Err(e) = job_repo.enqueue_job(&job, "trigger", Some(&trigger_name)).await {
                                error!("Failed to enqueue job for trigger '{}': {}", trigger_name, e);
                            } else {
                                info!("Enqueued job for trigger '{}'", trigger_name);
                            }
                            *last_run = Some(next_time);
                            *next_run = schedule.after(&next_time).next();
                            if let Some(new_next) = *next_run {
                                let new_duration = (new_next - now).to_std()
                                    .unwrap_or_else(|_| Duration::from_secs(1));
                                debug!("Trigger '{}': next run at {:?}, sleep duration {:?}", trigger_name, new_next, new_duration);
                                next_wakeup = Some(
                                    next_wakeup
                                        .map(|d: Duration| d.min(new_duration))
                                        .unwrap_or(new_duration)
                                );
                            }
                        } else {
                            let duration = (next_time - now).to_std()
                                .unwrap_or_else(|_| Duration::from_secs(1));
                            debug!("Trigger '{}': next run at {:?}, sleep duration {:?}", trigger_name, next_time, duration);
                            next_wakeup = Some(
                                next_wakeup
                                    .map(|d: Duration| d.min(duration))
                                    .unwrap_or(duration)
                            );
                        }
                    } else {
                        error!("No next occurrence for trigger '{}'", trigger_name);
                    }
                }

                match next_wakeup {
                    Some(duration) => {
                        debug!("Sleeping for {:?}", duration);
                        tokio::select! {
                            _ = time::sleep(duration) => {},
                            _ = cancel_rx.changed() => {
                                if *cancel_rx.borrow() {
                                    info!("Scheduler stopping due to cancellation signal");
                                    break;
                                }
                            }
                            _ = config_rx.changed() => {
                                info!("Reloading scheduler due to workspace config change");
                                let new_config = config_rx.borrow().clone();
                                schedules = Self::load_config(new_config, Some(&schedules));
                            }
                        }
                    }
                    None => {
                        info!("No valid schedules to run, waiting for config reload");
                        tokio::select! {
                                _ = config_rx.changed() => {
                                    info!("Config reloaded, checking for new schedules");
                                    schedules = Self::load_config(config_rx.borrow().clone(), Some(&schedules));
                                }
                                _ = cancel_rx.changed() => {
                                    if *cancel_rx.borrow() {
                                        info!("Scheduler stopping due to cancellation signal");
                                        break;
                                    }
                                }
                            }
                    }
                }
            }
        });

        self.task = Some(task);
        info!("Scheduler started");
    }

    pub async fn stop(&mut self) {
        if let Some(task) = self.task.take() {
            if let Err(e) = self.cancel_tx.send(true) {
                error!("Failed to send cancellation signal: {}", e);
            }
            let _ = task.await;
            info!("Scheduler stopped");
        } else {
            info!("Scheduler not running");
        }
    }
}