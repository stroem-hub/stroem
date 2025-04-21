use aws_config::defaults;
use axum::http::{header, HeaderMap, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use serde_json::{json, Value};

pub struct ApiResponse {
    pub status: StatusCode,
    pub success: bool,
    pub data: Option<Value>,
    pub error: Option<anyhow::Error>,
    pub headers: HeaderMap,
}

impl Default for ApiResponse {
    fn default() -> Self {
        Self {
            status: StatusCode::OK,
            success: true,
            data: None,
            error: None,
            headers: HeaderMap::new(),
        }
    }
}

impl IntoResponse for ApiResponse {
    fn into_response(mut self) -> Response {
        let msg = match self.success {
            true => json!({
                "success": true,
                "data": self.data,
            }),
            false => json!({
                "success": false,
                "error": self.error.map(|e| e.to_string()),
            })
        };

        self.headers
            .entry(header::CONTENT_TYPE)
            .or_insert(HeaderValue::from_static("application/json"));


        (self.status, self.headers, msg.to_string()).into_response()
    }
}

impl ApiResponse {
    pub fn with_headers(data: Value, headers: HeaderMap) -> Self {
        Self {
            data: Some(data),
            headers,
            ..Default::default()
        }
    }
    pub fn data(data: Value) -> Self {
        Self {
            data: Some(data),
            ..Default::default()
        }
    }
}


pub type ApiError = ApiResponse;
impl ApiError {
    pub fn unauthorized(msg: &str) -> Self {
        Self {
            status: StatusCode::UNAUTHORIZED,
            success: false,
            error: Some(anyhow::anyhow!(msg.to_string())),
            ..Default::default()
        }
    }

    pub fn not_found(msg: &str) -> Self {
        Self {
            status: StatusCode::NOT_FOUND,
            success: false,
            error: Some(anyhow::anyhow!(msg.to_string())),
            ..Default::default()
        }
    }

    pub fn bad_request(msg: &str) -> Self {
        Self {
            status: StatusCode::BAD_REQUEST,
            success: false,
            error: Some(anyhow::anyhow!(msg.to_string())),
            ..Default::default()
        }
    }
}

impl<E> From<E> for ApiError
where
    E: Into<anyhow::Error>,
{
    fn from(err: E) -> Self {
        ApiError {
            status: StatusCode::INTERNAL_SERVER_ERROR,
            error: Some(err.into()),
            success: false,
            ..Default::default()
        }
    }
}