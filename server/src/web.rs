
use std::collections::HashMap;
use std::convert::Infallible;
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::task::{Context, Poll};
use axum::body::Body;
use axum::extract::State;
use axum::http::{StatusCode, Uri};
use axum::response::{IntoResponse, Response};
use axum::response::sse::Event;
use axum::Router;
use axum::routing::get;
use futures::Stream;
use mime_guess::from_path;
use rust_embed::RustEmbed;
use serde::Serialize;
use serde_json::{json, Value};
use tokio::net::TcpListener;
use tokio::sync::broadcast::Sender;
use tracing::{debug, info};
use crate::repository::{JobRepository, LogRepository};
use crate::workspace_server::WorkspaceServer;

mod api;
use api::get_routes as api_get_routes;
use api::JobEvent;

mod worker;
mod auth;
mod api_response;

use worker::get_routes as worker_get_routes;
use auth::get_routes as auth_get_routes;
use crate::auth::AuthService;
use crate::error::ApiError;

#[derive(RustEmbed)]
#[folder = "static/"]
#[prefix = ""]
struct StaticAssets;

#[derive(Clone)]
pub struct WebState {
    pub workspace: Arc<WorkspaceServer>,
    pub job_repository: JobRepository,
    pub log_repository: Arc<dyn LogRepository + Send + Sync>,
    pub job_channels: Arc<Mutex<HashMap<String, Sender<JobEvent>>>>,
    pub auth_service: AuthService,
}


impl WebState {
    pub fn new(workspace: Arc<WorkspaceServer>, job_repository: JobRepository, log_repository: Arc<dyn LogRepository + Send + Sync>, auth: AuthService) -> Self {
        Self {
            workspace,
            job_repository,
            log_repository,
            job_channels: Arc::new(Mutex::new(HashMap::new())),
            auth_service: auth,
        }
    }
}


pub async fn run(state: WebState, addr: &str) {
    let app = Router::new()
        .route("/healthz", get(health_check))
        .route("/readyz", get(ready_check))
        .merge(auth_get_routes())
        .merge(api_get_routes())
        .merge(worker_get_routes())
        .route("/{*path}", get(serve_static))
        .route("/", get(serve_static))
        .with_state(state);

    let listener = TcpListener::bind(addr).await.unwrap();
    info!("Server starting on {}", addr);
    axum::serve(listener, app.into_make_service())
        .await
        .unwrap();
}


async fn serve_static(uri: Uri) -> impl IntoResponse {
    let path = uri.path();
    let path = path.trim_start_matches('/'); // Remove leading slash
    debug!("Serving static file at {}", path);
    match StaticAssets::get(path) {
        Some(file) => {
            let mime = from_path(path).first_or_octet_stream();
            Response::builder()
                .status(StatusCode::OK)
                .header("Content-Type", mime.as_ref())
                .body(Body::from(file.data))
                .unwrap()
        }
        None => {
            // Fallback to index.html for SPA routing
            match StaticAssets::get("index.html") {
                Some(file) => Response::builder()
                    .status(StatusCode::OK)
                    .header("Content-Type", "text/html")
                    .body(file.data.into())
                    .unwrap(),
                None => Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body("404 Not Found".into())
                    .unwrap(),
            }
        }
    }
}

#[axum::debug_handler]
async fn health_check() -> impl IntoResponse {
    StatusCode::OK
}

#[axum::debug_handler]
async fn ready_check(State(api): State<WebState>) -> impl IntoResponse {
    // TODO: Add checks for DB connection, workspace availability.
    StatusCode::OK
}

