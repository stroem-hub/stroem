use axum_cookie::prelude::*;
use axum_cookie::cookie::Cookie;
use std::collections::HashMap;
use anyhow::{anyhow, Error};
use axum::routing::{get, post};
use serde_json::{json, Value};
use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, StatusCode},
    Json, Router
};
use axum::extract::{FromRequestParts, Query};
use axum::http::request::Parts;
use axum::response::IntoResponse;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use crate::auth::{AuthResponse, User};
use crate::web::api_response::{ApiResponse, ApiError};
use crate::web::WebState;
use serde::{Deserialize, Serialize};
use tracing::{error, info};

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct OIDCResponse {
    pub state: Option<String>,
    pub session_state: Option<String>,
    pub code: Option<String>,
    pub error: Option<String>,
    pub error_description: Option<String>
}

pub fn get_routes() -> Router<WebState> {
    Router::new()
        .route("/api/auth/providers", get(get_providers))
        .route("/api/auth/{:provider_id}/login", post(post_login))
        .route("/auth/{:provider_id}/callback", get(oidc_callback))
        .route("/api/auth/refresh", post(refresh_token))
        .route("/api/auth/logout", get(logout))
        .route("/api/auth/info", get(user_info))
        .layer(CookieLayer::default())
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
            let jwt = state.auth_service.issue_jwt(&user.user_id, &user.email).await?;
            let (refresh_token, expiration) = state.auth_service.issue_refresh_token(&provider_id, &user.user_id).await?;

            let headers = refresh_token_cookie(state.public_url.scheme() == "https", refresh_token, expiration)?;

            let data = json!({
                "access_token": jwt,
                "user": user
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

fn refresh_token_cookie(secure: bool, refresh_token: String, expiration: DateTime<Utc>) -> Result<HeaderMap, Error> {
    let cookie = Cookie::builder("refresh_token", refresh_token)
        .http_only(true)
        .secure(secure) // only over HTTPS!
        .path("/")
        .same_site(SameSite::Lax)
        .max_age((expiration - Utc::now()).to_std()?)
        .build();

    let mut headers = HeaderMap::new();
    headers.insert(
        header::SET_COOKIE,
        HeaderValue::from_str(&cookie.to_string())?,
    );
    Ok(headers)
}


pub struct LoginError(anyhow::Error);
impl IntoResponse for LoginError {
    fn into_response(self) -> axum::response::Response {
        let mut headers = HeaderMap::new();
        headers.append(header::LOCATION, HeaderValue::from_static("/login"));
        // , format!("Error: {}", self.0)
        error!("LoginError: {:?}", self.0);
        (StatusCode::TEMPORARY_REDIRECT, headers).into_response()
    }
}
impl<E> From<E> for LoginError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        Self(err.into())
    }
}

#[axum::debug_handler]
async fn oidc_callback(
    State(state): State<WebState>,
    Path(provider_id): Path<String>,
    Query(oidc_response): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, LoginError> {
    // http://localhost:8080/auth/allunite/callback?
    // session_state=013a4cf2-b2be-4746-be95-9d56fb61cd47
    // &iss=https%3A%2F%2Fauth.allunite.com%2Frealms%2Finternal
    // &code=9c334c47-daeb-401b-bf55-07371a2724a9.013a4cf2-b2be-4746-be95-9d56fb61cd47.fbbcddfe-96c2-43c0-8b33-230f322a6c00
    info!("oidc_response: {:?}", oidc_response);
    if oidc_response.is_empty() {
        error!("oidc_response empty");
         return Err(anyhow!("OIDC call returned an empty response"))?;
    }
    
    if let Some(error) = oidc_response.get("error") {
        let error_description = oidc_response.get("error_description").unwrap();
        error!("OIDC error: {} - {:?}", error, error_description);
        return Err(anyhow!("OIDC call returned an error: {} ({})", error_description, error))?;
    }

    let result = state.auth_service.authenticate_with(&provider_id, oidc_response).await?;
    match result {
        AuthResponse::Success(user) => {
            let (refresh_token, expiration) = state.auth_service.issue_refresh_token(&provider_id, &user.user_id).await?;
            let mut headers = refresh_token_cookie(state.public_url.scheme() == "https", refresh_token, expiration)?;
            
            headers.append(header::LOCATION, HeaderValue::from_static("/"));
            return Ok((StatusCode::TEMPORARY_REDIRECT, headers, "Success"));
        }
        _ => {}
    }

    Err(anyhow!("Error logging in"))?
}

#[axum::debug_handler]
async fn refresh_token(
    State(state): State<WebState>,
    jar: CookieManager,
) -> Result<impl IntoResponse, ApiError> {
    let refresh_token = jar.get("refresh_token")
        .ok_or_else(|| anyhow!("Missing refresh token"))?
        .value()
        .to_string();

    let (jwt, user) = state.auth_service
        .refresh_access_token(&refresh_token)
        .await
        .map_err(|e| anyhow!(e.to_string()))?;

    Ok(ApiResponse::data(json!({
        "success": true,
        "access_token": jwt,
        "user": user
    })))
}

#[axum::debug_handler]
async fn user_info(
    State(_state): State<WebState>,
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
    let cookie = Cookie::builder("refresh_token", "")
        .http_only(true)
        .path("/")
        .same_site(SameSite::Lax)
        .max_age(std::time::Duration::from_secs(0))
        .build();

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