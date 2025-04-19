use std::collections::HashMap;
use anyhow::{anyhow, bail};
use axum::routing::{get, post};
use serde_json::{json, Value};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, Response, StatusCode},
    Json, Router
};
use axum::response::IntoResponse;
use chrono::{Duration, TimeDelta};
use axum_extra::extract::cookie::{Cookie, SameSite};
use crate::auth::AuthResponse;
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
) -> Result<impl IntoResponse, ApiError> {

    let result = state.auth_service.authenticate_with(&provider_id, payload).await?;

    match result {
        AuthResponse::Success(user) => {
            let jwt = state.auth_service.issue_jwt(&user.user_id, user.email.clone()).await?;
            let refresh_token = state.auth_service.issue_refresh_token(&provider_id, &user.user_id).await?;

            let mut cookie = Cookie::build(("refresh_token", refresh_token))
                .http_only(true)
                // .secure(true) // only over HTTPS!
                .path("/")
                .same_site(SameSite::Lax);
                // .max_age(std::time::Duration::from_secs(30*24*60*60));

            let mut headers = HeaderMap::new();
            headers.insert(
                header::SET_COOKIE,
                HeaderValue::from_str(&cookie.to_string())?,
            );

            let body = json!({
                "success": true,
                "access_token": jwt,
                "user": {
                    "user_id": user.user_id,
                    "email": user.email,
                    "name": user.name,
                }
            });
            
            return Ok((headers, body.to_string()));
        }

        AuthResponse::WrongCredentials => Err(ApiError::unauthorized("Wrong credentials")),
        AuthResponse::UserNotFound => Err(ApiError::not_found("User not found")),
        AuthResponse::Redirect(url) => {
            let body = json!({ "success": true, "redirect": url });
            let headers = HeaderMap::new();
            Ok((headers, body.to_string()))
        }
    }
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