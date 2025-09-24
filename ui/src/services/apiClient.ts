import type { AppError } from '../types';
import { tokenStorage } from '../utils/tokenStorage';
import { buildApiUrl } from '../utils';

/**
 * HTTP methods supported by the API client
 */
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Request configuration interface
 */
interface RequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  requiresAuth?: boolean;
  retries?: number;
}

/**
 * Response wrapper for API calls
 */
interface ApiClientResponse<T> {
  data: T;
  status: number;
  headers: Headers;
}

/**
 * API Client class with authentication and error handling
 */
class ApiClient {
  private defaultHeaders: Record<string, string>;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    this.defaultHeaders = {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Add default header
   */
  setDefaultHeader(key: string, value: string): void {
    this.defaultHeaders[key] = value;
  }

  /**
   * Remove default header
   */
  removeDefaultHeader(key: string): void {
    delete this.defaultHeaders[key];
  }

  /**
   * Build full URL for endpoint
   */
  private buildUrl(endpoint: string): string {
    if (endpoint.startsWith('http')) {
      return endpoint;
    }
    return buildApiUrl(endpoint);
  }

  /**
   * Build headers for request
   */
  private buildHeaders(config: RequestConfig): Record<string, string> {
    const headers = { ...this.defaultHeaders, ...config.headers };

    // Add authentication header if required and token is available
    if (config.requiresAuth !== false) {
      const token = tokenStorage.getToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Handle API errors and convert to AppError
   */
  private async handleError(response: Response): Promise<AppError> {
    let errorMessage = 'An unexpected error occurred';
    let errorType: AppError['type'] = 'server';

    try {
      const errorData = await response.json();
      errorMessage = errorData.message || errorData.error || errorMessage;
    } catch {
      // If we can't parse the error response, use status text
      errorMessage = response.statusText || errorMessage;
    }

    // Determine error type based on status code
    switch (response.status) {
      case 401:
        errorType = 'auth';
        errorMessage = 'Authentication required';
        break;
      case 403:
        errorType = 'auth';
        errorMessage = 'Access denied';
        break;
      case 400:
        errorType = 'validation';
        break;
      case 404:
        errorMessage = 'Resource not found';
        break;
      case 429:
        errorMessage = 'Too many requests. Please try again later.';
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        errorType = 'server';
        errorMessage = 'Server error. Please try again later.';
        break;
    }

    return {
      type: errorType,
      message: errorMessage,
      recoverable: response.status < 500,
    };
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequest<T>(
    endpoint: string,
    config: RequestConfig
  ): Promise<ApiClientResponse<T>> {
    const url = this.buildUrl(endpoint);
    const headers = this.buildHeaders(config);
    const retries = config.retries ?? this.maxRetries;

    let lastError: AppError | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const requestInit: RequestInit = {
          method: config.method,
          headers,
          credentials: 'include', // Include cookies for authentication
        };

        // Add body for non-GET requests
        if (config.body && config.method !== 'GET') {
          requestInit.body = JSON.stringify(config.body);
        }

        const response = await fetch(url, requestInit);

        // Handle authentication errors
        if (response.status === 401) {
          // Try to refresh token if available
          const refreshed = await this.refreshToken();
          if (refreshed && attempt < retries) {
            // Retry with new token
            continue;
          }
          // If refresh failed or no more retries, throw auth error
          throw await this.handleError(response);
        }

        // Handle other errors
        if (!response.ok) {
          const error = await this.handleError(response);
          
          // Don't retry client errors (4xx) except 401
          if (response.status >= 400 && response.status < 500) {
            throw error;
          }
          
          // Retry server errors (5xx) and network errors
          if (attempt < retries) {
            lastError = error;
            await this.sleep(this.retryDelay * Math.pow(2, attempt));
            continue;
          }
          
          throw error;
        }

        // Parse response
        const data = await response.json();

        return {
          data,
          status: response.status,
          headers: response.headers,
        };
      } catch (error) {
        // Handle network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          const networkError: AppError = {
            type: 'network',
            message: 'Network error. Please check your connection.',
            recoverable: true,
          };

          if (attempt < retries) {
            lastError = networkError;
            await this.sleep(this.retryDelay * Math.pow(2, attempt));
            continue;
          }

          throw networkError;
        }

        // Re-throw AppError instances
        if (error && typeof error === 'object' && 'type' in error) {
          throw error;
        }

        // Handle unexpected errors
        const unexpectedError: AppError = {
          type: 'server',
          message: error instanceof Error ? error.message : 'An unexpected error occurred',
          recoverable: false,
        };

        if (attempt < retries) {
          lastError = unexpectedError;
          await this.sleep(this.retryDelay * Math.pow(2, attempt));
          continue;
        }

        throw unexpectedError;
      }
    }

    // If we get here, all retries failed
    throw lastError || {
      type: 'server',
      message: 'Request failed after multiple attempts',
      recoverable: true,
    };
  }

  /**
   * Attempt to refresh authentication token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      const refreshToken = tokenStorage.getRefreshToken();

      // Try refresh with either stored token or cookies
      const response = await fetch(this.buildUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for OIDC
        body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
      });

      if (!response.ok) {
        tokenStorage.clearToken();
        return false;
      }

      const data = await response.json();

      // Handle server's wrapped response format
      let accessToken = null;
      if (data.success && data.data) {
        accessToken = data.data.access_token;
      } else if (data.access_token) {
        accessToken = data.access_token;
      }

      if (accessToken) {
        // Extract expiration time from token or use default
        const expiration = tokenStorage.getTokenExpiration(accessToken);
        if (expiration) {
          const expiresIn = Math.floor((expiration - Date.now()) / 1000);
          tokenStorage.setToken(accessToken, expiresIn);
        } else {
          // Default to 1 hour if no expiration in token
          tokenStorage.setToken(accessToken, 3600);
        }
        return true;
      }

      return false;
    } catch {
      tokenStorage.clearToken();
      return false;
    }
  }

  /**
   * GET request
   */
  async get<T>(endpoint: string, config: Partial<RequestConfig> = {}): Promise<T> {
    const response = await this.makeRequest<T>(endpoint, {
      method: 'GET',
      ...config,
    });
    return response.data;
  }

  /**
   * POST request
   */
  async post<T>(
    endpoint: string,
    data?: unknown,
    config: Partial<RequestConfig> = {}
  ): Promise<T> {
    const response = await this.makeRequest<T>(endpoint, {
      method: 'POST',
      body: data,
      ...config,
    });
    return response.data;
  }

  /**
   * PUT request
   */
  async put<T>(
    endpoint: string,
    data?: unknown,
    config: Partial<RequestConfig> = {}
  ): Promise<T> {
    const response = await this.makeRequest<T>(endpoint, {
      method: 'PUT',
      body: data,
      ...config,
    });
    return response.data;
  }

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, config: Partial<RequestConfig> = {}): Promise<T> {
    const response = await this.makeRequest<T>(endpoint, {
      method: 'DELETE',
      ...config,
    });
    return response.data;
  }

  /**
   * Raw request method for custom configurations
   */
  async request<T>(endpoint: string, config: RequestConfig): Promise<ApiClientResponse<T>> {
    return this.makeRequest<T>(endpoint, config);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// Export class for testing
export { ApiClient };

// Export types
export type { RequestConfig, ApiClientResponse };