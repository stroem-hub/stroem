// server/src/scheduler.rs
use crate::Job;
use crate::workspace::WorkspaceConfiguration;
use tokio::sync::mpsc::Sender;
use tokio::sync::watch;
use tracing::{info, error, debug};
use cron::Schedule;
use std::str::FromStr;
use tokio::time::{self, Duration};
use tokio::sync::oneshot;
use std::collections::HashMap;
use chrono::{Utc, DateTime};

pub struct Scheduler {
    schedules: Vec<(Schedule, Job, String, Option<DateTime<Utc>>, Option<DateTime<Utc>>)>,
    tx: Sender<Job>,
    task: Option<tokio::task::JoinHandle<()>>,
    cancel_tx: watch::Sender<bool>,
}

impl Scheduler {
    fn load_config(config: &WorkspaceConfiguration)
                   -> Vec<(Schedule, Job, String, Option<DateTime<Utc>>, Option<DateTime<Utc>>)>
    {
        let mut schedules: Vec<(Schedule, Job, String, Option<DateTime<Utc>>, Option<DateTime<Utc>>)> = Vec::new();
        if let Some(triggers) = &config.workflow_data.triggers {
            for (trigger_name, trigger) in triggers.iter() {
                if trigger.trigger_type == "cron" {
                    if let Some(cron_expr) = &trigger.cron {
                        match Schedule::from_str(cron_expr) {
                            Ok(schedule) => {
                                let job = Job {
                                    task: trigger.task.clone(),
                                    input: trigger.input.clone()
                                        .map(|inputs| {
                                            let mut map = serde_json::Map::new();
                                            for (k, v) in inputs {
                                                map.insert(k, serde_json::Value::String(v));
                                            }
                                            serde_json::Value::Object(map)
                                        })
                                        .unwrap_or(serde_json::Value::Null),
                                };
                                info!("Added trigger '{}' to scheduler: {}", trigger_name, cron_expr);
                                schedules.push((schedule, job, trigger_name.clone(), None, None));
                            }
                            Err(e) => error!("Invalid cron expression for trigger '{}': {}", trigger_name, e),
                        }
                    }
                }
            }
        }
        schedules
    }

    pub fn new(tx: &Sender<Job>, config: &WorkspaceConfiguration) -> Self {
        let (cancel_tx, _) = watch::channel(false);
        Self {
            tx: tx.clone(),
            schedules: Self::load_config(&config),
            task: None,
            cancel_tx
        }
    }

    pub async fn run(&mut self) {
        if self.task.is_some() {
            info!("Scheduler already running");
            return;
        }

        if self.schedules.is_empty() {
            info!("No cron triggers found to schedule");
            return;
        }

        let tx = self.tx.clone();
        let mut schedules = self.schedules.clone(); // Clone schedules for the task
        let mut cancel_rx = self.cancel_tx.subscribe();

        let task = tokio::spawn(async move {
            loop {
                let now = Utc::now();
                let mut next_wakeup = None;

                for (schedule, job, trigger_name, last_run, next_run) in &mut schedules {
                    debug!("Processing trigger '{}'", trigger_name);
                    if next_run.is_none() {
                        *next_run = schedule.after(&last_run.unwrap_or(now)).next();
                    }

                    if let Some(next_time) = *next_run {
                        if now >= next_time {
                            let job = Job {
                                task: job.task.clone(),
                                input: job.input.clone(),
                            };
                            if let Err(e) = tx.send(job).await {
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
                        }
                    }
                    None => {
                        info!("No more valid schedules to run");
                        break;
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
            let _ = task.await; // Wait for the task to complete
            info!("Scheduler stopped");
        } else {
            info!("Scheduler not running");
        }
    }
}