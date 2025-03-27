// workflow-server/src/queue.rs
use stroem_common::JobRequest;
use tokio::sync::mpsc::{self, Sender, Receiver};
use std::sync::{Arc, Mutex};
use tracing::{info, error, debug};
use uuid::Uuid;

#[derive(Clone)]
pub struct Queue {
    tx: Sender<JobRequest>,
    rx: Arc<Mutex<Receiver<JobRequest>>>,
}

impl Queue {
    pub fn new(capacity: usize) -> Self {
        let (tx, rx) = mpsc::channel::<JobRequest>(capacity);
        Queue {
            tx,
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    pub async fn enqueue(&self, mut job: JobRequest) -> Result<String, String> {
        let uuid = Uuid::new_v4().to_string();
        job.uuid = Some(uuid.clone());
        info!("Enqueuing job: {:?}", job);
        self.tx.send(job).await.map_err(|e| e.to_string())?;
        Ok(uuid)
    }

    pub fn dequeue(&self) -> Result<Option<JobRequest>, String> {
        let mut rx = self.rx.lock().unwrap();
        match rx.try_recv() {
            Ok(job) => {
                info!("Dequeued job: {:?}", job);
                Ok(Some(job))
            }
            Err(tokio::sync::mpsc::error::TryRecvError::Empty) => {
                debug!("No jobs in queue");
                Ok(None)
            }
            Err(tokio::sync::mpsc::error::TryRecvError::Disconnected) => {
                error!("Queue sender disconnected");
                Err("Queue sender disconnected".to_string())
            }
        }
    }
}