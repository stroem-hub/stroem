use std::collections::HashMap;
use anyhow::anyhow;
use axum::extract::{Path, State};
use axum::{Json, Router};
use axum::routing::{get, post};
use serde_json::{json, Value};
use crate::error::ApiError;
use crate::web::WebState;

pub fn get_routes() -> Router<WebState> {
    Router::new()
        .route("/auth/providers", get(get_providers))
        .route("/auth/{:provider_id}/login", post(post_login))
        .route("/auth/{:provider_id}/callback", get(oidc_callback))
        .route("/auth/refresh", post(refresh_token))
}

#[axum::debug_handler]
async fn get_providers(
    State(state): State<WebState>,
) -> Result<Json<Value>, ApiError> {
    Ok(json!({
        "success": true,
    }).into())
}

#[axum::debug_handler]
async fn post_login(
    State(state): State<WebState>,
    Path(provider_id): Path<String>,
    Json(payload): Json<HashMap<String, String>>,
) -> Result<Json<Value>, ApiError> {

    let result = state.auth_service.authenticate_with(&provider_id, payload).await?;
    
    Ok(json!({
        "success": true,
    }).into())
}

#[axum::debug_handler]
async fn oidc_callback(
    State(state): State<WebState>,
    Path(provider_id): Path<String>,
) -> Result<Json<Value>, ApiError> {
    Ok(json!({
        "success": true,
    }).into())
}

#[axum::debug_handler]
async fn refresh_token(
    State(api): State<WebState>,
) -> Result<Json<Value>, ApiError> {
    Ok(json!({
        "success": true,
    }).into())
}