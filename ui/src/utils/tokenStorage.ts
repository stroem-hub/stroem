/**
 * Token storage utilities with memory-based JWT storage
 * Implements secure token management with automatic cleanup
 */



class TokenStorage {
  private token: string | null = null;
  private refreshToken: string | null = null;
  private expiresAt: number | null = null;

  /**
   * Store JWT token in memory with expiration time
   */
  setToken(token: string, expiresIn?: number): void {
    this.token = token;
    
    // Calculate expiration time (default to 1 hour if not provided)
    const expirationTime = expiresIn || 3600; // 1 hour in seconds
    this.expiresAt = Date.now() + (expirationTime * 1000);
  }

  /**
   * Get current JWT token if valid
   */
  getToken(): string | null {
    if (!this.token || !this.expiresAt) {
      return null;
    }

    // Check if token is expired (with 5 minute buffer)
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    if (Date.now() >= (this.expiresAt - bufferTime)) {
      this.clearToken();
      return null;
    }

    return this.token;
  }

  /**
   * Store refresh token (if supported by backend)
   */
  setRefreshToken(refreshToken: string): void {
    this.refreshToken = refreshToken;
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Check if token exists and is valid
   */
  hasValidToken(): boolean {
    return this.getToken() !== null;
  }

  /**
   * Check if token is expired or about to expire
   */
  isTokenExpired(): boolean {
    if (!this.expiresAt) {
      return true;
    }

    // Consider expired if less than 5 minutes remaining
    const bufferTime = 5 * 60 * 1000; // 5 minutes in milliseconds
    return Date.now() >= (this.expiresAt - bufferTime);
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    if (!this.expiresAt) {
      return 0;
    }
    return Math.max(0, this.expiresAt - Date.now());
  }

  /**
   * Clear all stored tokens
   */
  clearToken(): void {
    this.token = null;
    this.refreshToken = null;
    this.expiresAt = null;
  }

  /**
   * Parse JWT token to extract payload (without verification)
   * Used for extracting expiration time and user info
   */
  parseJwtPayload(token: string): Record<string, unknown> | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];
      if (!payload) return null;
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  /**
   * Extract expiration time from JWT token
   */
  getTokenExpiration(token: string): number | null {
    const payload = this.parseJwtPayload(token);
    if (!payload || typeof payload['exp'] !== 'number') {
      return null;
    }
    return (payload['exp'] as number) * 1000; // Convert to milliseconds
  }
}

// Create singleton instance
export const tokenStorage = new TokenStorage();

// Export utilities for testing
export { TokenStorage };