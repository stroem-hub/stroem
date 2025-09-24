import { apiClient } from './apiClient';
import type { 
  AuthProvidersResponse, 
  LoginRequest, 
  RefreshTokenRequest, 
  RefreshTokenResponse
} from './apiTypes';
import type { User, AuthResponse } from '../types';
import { tokenStorage } from '../utils/tokenStorage';

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

      return authResponse;
    }

    throw new Error('Invalid authentication response');
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<RefreshTokenResponse | null> {
    const refreshToken = tokenStorage.getRefreshToken();
    if (!refreshToken) {
      return null;
    }

    try {
      const request: RefreshTokenRequest = {
        refresh_token: refreshToken,
      };

      const response = await apiClient.post<any>(
        '/api/auth/refresh',
        request,
        { requiresAuth: false }
      );

      // Handle server's wrapped response format
      let responseData = response;
      if (response && response.success && response.data) {
        responseData = response.data;
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
      }

      return response;
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
    // Handle server's wrapped response format: {"success": true, "data": user}
    if (response && response.success && response.data) {
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