use std::collections::HashMap;
use std::time;
use anyhow::{anyhow, bail};
use async_trait::async_trait;
use axum::routing::{get, post};
use serde_json::{json, Value};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, Response, StatusCode},
    Json, Router
};
use axum::extract::FromRequestParts;
use axum::http::request::Parts;
use axum::response::IntoResponse;
use axum_extra::extract::cookie::{Cookie, SameSite};
use axum_extra::extract::CookieJar;
use futures_util::future::BoxFuture;
use uuid::Uuid;
use crate::auth::{AuthResponse, User};
// use crate::error::ApiError;
use crate::web::api_response::{ApiResponse, ApiError};
use crate::web::WebState;


pub fn get_routes() -> Router<WebState> {
    Router::new()
        .route("/auth/providers", get(get_providers))
        .route("/auth/{:provider_id}/login", post(post_login))
        .route("/auth/{:provider_id}/callback", get(oidc_callback))
        .route("/auth/refresh", post(refresh_token))
        .route("/auth/logout", get(logout))
        .route("/auth/info", get(user_info))
}

#[axum::debug_handler]
async fn get_providers(
    State(state): State<WebState>,
) -> ApiResponse {
    
    let data = state.auth_service.get_providers();
    ApiResponse::data(Value::from(data))
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

            let cookie = Cookie::build(("refresh_token", refresh_token))
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

            let data = json!({
                "access_token": jwt,
                "user": {
                    "user_id": user.user_id,
                    "email": user.email,
                    "name": user.name,
                }
            });
            Ok(ApiResponse::with_headers(data, headers))
        }

        AuthResponse::WrongCredentials => Err(ApiError::unauthorized("Wrong credentials")),
        AuthResponse::UserNotFound => Err(ApiError::not_found("User not found")),
        AuthResponse::Redirect(url) => {
            let data = json!({ "redirect": url });
            Ok(ApiResponse::data(data))
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
    State(state): State<WebState>,
    jar: CookieJar,
) -> Result<impl IntoResponse, ApiError> {
    let refresh_token = jar.get("refresh_token")
        .ok_or_else(|| ApiError::unauthorized("Missing refresh token"))?
        .value()
        .to_string();

    let jwt = state.auth_service
        .refresh_access_token(&refresh_token)
        .await
        .map_err(|e| ApiError::unauthorized(&e.to_string()))?;

    Ok(ApiResponse::data(json!({
        "success": true,
        "access_token": jwt
    })))
}

#[axum::debug_handler]
async fn user_info(
    State(state): State<WebState>,
    user: User,
) -> Result<ApiResponse, ApiError> {
    Ok(ApiResponse::data(json!({
        "success": true,
        "data": user
    })))
}

#[axum::debug_handler]
async fn logout(
    State(state): State<WebState>,
    user: User,
) -> Result<ApiResponse, ApiError> {
    state.auth_service.logout_user(&user.user_id).await?;

    // Clear the refresh_token cookie
    let mut cookie = Cookie::build(("refresh_token", ""))
        .http_only(true)
        .path("/")
        .same_site(SameSite::Lax);
        // .max_age(time::Duration::seconds(0));

    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie.to_string())?,
    );
    
    Ok(ApiResponse::with_headers(json!({}), headers))
}



impl FromRequestParts<WebState> for User {
    type Rejection = ApiError;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &WebState,
    ) -> Result<Self, Self::Rejection> {
        let auth_header = parts.headers
            .get("authorization")
            .ok_or(ApiError::unauthorized("Missing Authorization header"))?
            .to_str()
            .map_err(|_| ApiError::unauthorized("Invalid Authorization header"))?;

        if !auth_header.to_lowercase().starts_with("bearer ") {
            return Err(ApiError::unauthorized("Invalid token format"));
        }

        let token = auth_header[7..].trim();

        let claims = state.auth_service
            .decode_jwt(token)
            .map_err(|e| ApiError::unauthorized(&format!("Invalid token: {}", e)))?;

        let user_id = Uuid::parse_str(&claims.sub)
            .map_err(|_| (ApiError::unauthorized("Invalid user ID in token")))?;


        Ok(User {
            user_id,
            name: None,
            email: claims.email,
        })
    }
}