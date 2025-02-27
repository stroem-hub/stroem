// server/src/queue.rs
use crate::Job;
use tokio::sync::mpsc::{self, Sender, Receiver};
use std::sync::{Arc, Mutex};
use tracing::{info, error, debug};

#[derive(Clone)]
pub struct Queue {
    tx: Sender<Job>,
    rx: Arc<Mutex<Receiver<Job>>>,
}

impl Queue {
    pub fn new(capacity: usize) -> Self {
        let (tx, rx) = mpsc::channel::<Job>(capacity);
        Queue {
            tx,
            rx: Arc::new(Mutex::new(rx)),
        }
    }

    pub async fn enqueue(&self, job: Job) -> Result<(), String> {
        info!("Enqueuing job: {:?}", job);
        self.tx.send(job).await.map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn dequeue(&self) -> Result<Option<Job>, String> {
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

    pub fn sender(&self) -> Sender<Job> {
        self.tx.clone()
    }
}