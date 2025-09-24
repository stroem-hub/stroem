import { apiClient } from './apiClient';
import type {
  AuthProvidersResponse,
  LoginRequest,
  RefreshTokenResponse
} from './apiTypes';
import type { User, AuthResponse } from '../types';
import { tokenStorage } from '../utils/tokenStorage';
import { buildApiUrl } from '../utils';

/**
 * Authentication service for handling login, logout, and token management
 */
export class AuthService {
  /**
   * Get available authentication providers
   */
  async getProviders(): Promise<{ providers: AuthProvidersResponse }> {
    const response = await apiClient.get<{ success: boolean; data: AuthProvidersResponse }>('/api/auth/providers', {
      requiresAuth: false,
    });
    return { providers: response.data };
  }

  /**
   * Login with credentials
   */
  async login(providerId: string, credentials: Record<string, unknown>): Promise<AuthResponse> {
    const loginRequest: LoginRequest = {
      provider_id: providerId,
      ...credentials,
    };

    const response = await apiClient.post<any>(
      `/api/auth/${providerId}/login`,
      loginRequest,
      { requiresAuth: false }
    );

    // Handle server's wrapped response format
    let responseData = response;
    if (response && response.success && response.data) {
      responseData = response.data;
    }

    // Handle OIDC redirect response
    if (responseData.redirect) {
      // For OIDC providers, redirect to the authorization URL
      window.location.href = responseData.redirect;
      // Return a placeholder response since we're redirecting
      return {
        token: '',
        user: {
          user_id: '',
          email: '',
          name: null,
        },
      };
    }

    // Handle direct authentication response (internal providers)
    if (responseData.access_token && responseData.user) {
      const authResponse: AuthResponse = {
        token: responseData.access_token,
        user: responseData.user,
      };

      // Store token with expiration
      const expiration = tokenStorage.getTokenExpiration(authResponse.token);
      if (expiration) {
        const expiresIn = Math.floor((expiration - Date.now()) / 1000);
        tokenStorage.setToken(authResponse.token, expiresIn);
      } else {
        // Default to 1 hour if no expiration in token
        tokenStorage.setToken(authResponse.token, 3600);
      }

      // Store refresh token if provided
      if (responseData.refresh_token) {
        tokenStorage.setRefreshToken(responseData.refresh_token);
      }

      return authResponse;
    }

    throw new Error('Invalid authentication response');
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<RefreshTokenResponse | null> {
    try {
      // First try with stored refresh token
      const refreshToken = tokenStorage.getRefreshToken();

      // If no stored refresh token, try with cookies (for OIDC)
      const response = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies for OIDC
        body: JSON.stringify(refreshToken ? { refresh_token: refreshToken } : {}),
      });

      if (!response.ok) {
        tokenStorage.clearToken();
        return null;
      }

      const data = await response.json();

      // Handle server's wrapped response format
      let responseData = data;
      if (data && data.success && data.data) {
        responseData = data.data;
      }

      // Update stored token
      if (responseData.access_token) {
        const expiration = tokenStorage.getTokenExpiration(responseData.access_token);
        if (expiration) {
          const expiresIn = Math.floor((expiration - Date.now()) / 1000);
          tokenStorage.setToken(responseData.access_token, expiresIn);
        } else {
          // Default to 1 hour if no expiration in token
          tokenStorage.setToken(responseData.access_token, 3600);
        }

        // Store new refresh token if provided
        if (responseData.refresh_token) {
          tokenStorage.setRefreshToken(responseData.refresh_token);
        }

        return responseData;
      }

      return null;
    } catch {
      // Clear tokens if refresh fails
      tokenStorage.clearToken();
      return null;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      // Call server logout endpoint
      await apiClient.get('/api/auth/logout');
    } catch {
      // Ignore errors during logout
    } finally {
      // Always clear local tokens
      tokenStorage.clearToken();
    }
  }

  /**
   * Get current user information
   */
  async getCurrentUser(): Promise<User> {
    const response = await apiClient.get<any>('/api/auth/info');
    // Handle server's wrapped response format: {"success": true, "data": {"user": user}}
    if (response && response.success && response.data) {
      // Extract user from nested data.user structure
      if (response.data.user) {
        return response.data.user;
      }
      return response.data;
    }
    return response as User;
  }

  /**
   * Check if user is currently authenticated
   */
  isAuthenticated(): boolean {
    return tokenStorage.hasValidToken();
  }

  /**
   * Exchange OIDC callback for tokens using cookies set by server
   */
  async exchangeOidcCallback(): Promise<AuthResponse | null> {
    try {
      // The server sets HTTP-only cookies during the OIDC callback
      // Use the refresh endpoint with credentials to get tokens
      const response = await fetch(buildApiUrl('/api/auth/refresh'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
        body: JSON.stringify({}), // Empty body, cookies contain the refresh token
      });

      if (!response.ok) {
        return null;
      }

      const data = await response.json();

      // Handle server's wrapped response format
      let responseData = data;
      if (data && data.success && data.data) {
        responseData = data.data;
      }

      if (responseData.access_token) {
        // Store token first so getCurrentUserFromToken can work
        const expiration = tokenStorage.getTokenExpiration(responseData.access_token);
        if (expiration) {
          const expiresIn = Math.floor((expiration - Date.now()) / 1000);
          tokenStorage.setToken(responseData.access_token, expiresIn);
        } else {
          tokenStorage.setToken(responseData.access_token, 3600);
        }

        // Get user from the token or make a separate call
        const user = this.getCurrentUserFromToken() || responseData.user;

        if (!user) {
          // If we can't get user from token, fetch it
          const userResponse = await this.getCurrentUser();
          if (userResponse) {
            const authResponse: AuthResponse = {
              token: responseData.access_token,
              user: userResponse,
            };

            // Store token with expiration
            const expiration = tokenStorage.getTokenExpiration(authResponse.token);
            if (expiration) {
              const expiresIn = Math.floor((expiration - Date.now()) / 1000);
              tokenStorage.setToken(authResponse.token, expiresIn);
            } else {
              tokenStorage.setToken(authResponse.token, 3600);
            }

            // Store refresh token if provided
            if (responseData.refresh_token) {
              tokenStorage.setRefreshToken(responseData.refresh_token);
            }

            return authResponse;
          }
        } else {
          const authResponse: AuthResponse = {
            token: responseData.access_token,
            user: user,
          };

          // Store token with expiration
          const expiration = tokenStorage.getTokenExpiration(authResponse.token);
          if (expiration) {
            const expiresIn = Math.floor((expiration - Date.now()) / 1000);
            tokenStorage.setToken(authResponse.token, expiresIn);
          } else {
            tokenStorage.setToken(authResponse.token, 3600);
          }

          // Store refresh token if provided
          if (responseData.refresh_token) {
            tokenStorage.setRefreshToken(responseData.refresh_token);
          }

          return authResponse;
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Get current user from token (without API call)
   */
  getCurrentUserFromToken(): User | null {
    const token = tokenStorage.getToken();
    if (!token) {
      return null;
    }

    try {
      const payload = tokenStorage.parseJwtPayload(token);
      if (payload && payload['user_id'] && payload['email']) {
        return {
          user_id: payload['user_id'] as string,
          email: payload['email'] as string,
          name: (payload['name'] as string) || null,
        };
      }
    } catch {
      // Invalid token
    }

    return null;
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(): boolean {
    return tokenStorage.isTokenExpired();
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    return tokenStorage.getTimeUntilExpiry();
  }
}

// Create singleton instance
export const authService = new AuthService();