// server/src/scheduler.rs
use crate::Job;
use crate::workspace::WorkspaceConfiguration;
use tokio::sync::mpsc::Sender;
use tracing::{info, error, debug};
use cron::Schedule;
use std::str::FromStr;
use tokio::time::{self, Duration};
use std::collections::HashMap;
use chrono::{Utc, DateTime};

pub async fn scheduler(tx: Sender<Job>, config: WorkspaceConfiguration) {
    // Build list of (Schedule, Job, String, Option<DateTime<Utc>>, Option<DateTime<Utc>>) pairs
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

    if schedules.is_empty() {
        info!("No cron triggers found to schedule");
        return;
    }

    // Single loop to check all schedules
    loop {
        let now = Utc::now();
        let mut next_wakeup = None;

        for (schedule, job, trigger_name, last_run, next_run) in &mut schedules {
            debug!("Processing trigger '{}'", trigger_name);
            // Calculate next_run if it’s None
            if next_run.is_none() {
                *next_run = schedule.after(&last_run.unwrap_or(now)).next();
            }

            if let Some(next_time) = *next_run {
                // Run job if it's time or past due

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
                    // Update last_run and next_run
                    *last_run = Some(next_time);
                    *next_run = schedule.after(&next_time).next();
                    if let Some(new_next) = *next_run {
                        let new_duration = (new_next - now).to_std()
                            .unwrap_or_else(|_| Duration::from_secs(1));
                        debug!("Trigger '{}': next run at {:?}, sleep duration {:?}", trigger_name, next_time, new_duration);
                        next_wakeup = Some(
                            next_wakeup
                                .map(|d: Duration| d.min(new_duration))
                                .unwrap_or(new_duration)
                        );
                    }
                }
                else {
                    let duration = (next_time - now).to_std()
                        .unwrap_or_else(|_| Duration::from_secs(1));
                    debug!("Trigger '{}': next run at {:?}, sleep duration {:?}", trigger_name, next_time, duration);

                    // Update next_wakeup to the earliest next time
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

        // Sleep until the earliest next run time, or exit if no schedules remain valid
        match next_wakeup {
            Some(duration) => {
                debug!("Sleeping for {:?}", duration);
                time::sleep(duration).await;
            }
            None => {
                info!("No more valid schedules to run");
                break;
            }
        }
    }
}