import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { User } from '../types';
import { tokenStorage } from '../utils/tokenStorage';

// Authentication state interface
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// Authentication actions
type AuthAction =
  | { type: 'AUTH_START' }
  | { type: 'AUTH_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'AUTH_FAILURE'; payload: string }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'AUTH_CLEAR_ERROR' }
  | { type: 'AUTH_RESTORE'; payload: User };

// Initial state
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// Auth reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'AUTH_START':
      return {
        ...state,
        isLoading: true,
        error: null,
      };

    case 'AUTH_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    case 'AUTH_FAILURE':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: action.payload,
      };

    case 'AUTH_LOGOUT':
      return {
        ...state,
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      };

    case 'AUTH_CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    case 'AUTH_RESTORE':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      };

    default:
      return state;
  }
};

// Context interface
interface AuthContextType extends AuthState {
  login: (providerId: string, credentials: Record<string, unknown>) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  refreshToken: () => Promise<boolean>;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auth provider props
interface AuthProviderProps {
  children: ReactNode;
}

// Auth provider component
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Restore authentication state on app load
  useEffect(() => {
    const restoreAuth = async () => {
      const token = tokenStorage.getToken();
      if (token) {
        try {
          // Parse user info from token
          const payload = tokenStorage.parseJwtPayload(token);
          if (payload && payload['user_id'] && payload['email']) {
            const user: User = {
              user_id: payload['user_id'] as string,
              email: payload['email'] as string,
              name: (payload['name'] as string) || null,
            };
            dispatch({ type: 'AUTH_RESTORE', payload: user });
          } else {
            // Invalid token, clear it
            tokenStorage.clearToken();
          }
        } catch {
          // Error parsing token, clear it
          tokenStorage.clearToken();
        }
      } else {
        // No token, but we might have a refresh token cookie from OIDC
        try {
          const { authService } = await import('../services/authService');
          dispatch({ type: 'AUTH_START' });

          // Try to exchange refresh token cookie for access token
          const refreshResponse = await authService.refreshToken();

          if (refreshResponse && refreshResponse.access_token) {
            // Get user from the new token
            const user = authService.getCurrentUserFromToken();
            if (user) {
              dispatch({ type: 'AUTH_SUCCESS', payload: { user, token: refreshResponse.access_token } });
            } else {
              // Fetch user info if not in token
              const userInfo = await authService.getCurrentUser();
              dispatch({ type: 'AUTH_SUCCESS', payload: { user: userInfo, token: refreshResponse.access_token } });
            }
          } else {
            dispatch({ type: 'AUTH_FAILURE', payload: '' });
          }
        } catch {
          dispatch({ type: 'AUTH_FAILURE', payload: '' });
        }
      }
    };

    restoreAuth();

    // Listen for auth success events (from OIDC callback)
    const handleAuthSuccess = (event: Event) => {
      const customEvent = event as CustomEvent<{ user: User; token: string }>;
      if (customEvent.detail && customEvent.detail.user && customEvent.detail.token) {
        dispatch({
          type: 'AUTH_SUCCESS',
          payload: {
            user: customEvent.detail.user,
            token: customEvent.detail.token
          }
        });
      }
    };

    window.addEventListener('auth:success', handleAuthSuccess);
    return () => {
      window.removeEventListener('auth:success', handleAuthSuccess);
    };
  }, []);

  // Auto-refresh token when it's about to expire
  useEffect(() => {
    if (!state.isAuthenticated) {
      return;
    }

    const checkTokenExpiry = () => {
      if (tokenStorage.isTokenExpired()) {
        refreshToken();
      }
    };

    // Check every minute
    const interval = setInterval(checkTokenExpiry, 60 * 1000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated]);

  // Login function
  const login = async (providerId: string, credentials: Record<string, unknown>): Promise<void> => {
    dispatch({ type: 'AUTH_START' });

    try {
      // Use the auth service for login
      const { authService } = await import('../services/authService');
      const authResponse = await authService.login(providerId, credentials);

      dispatch({ 
        type: 'AUTH_SUCCESS', 
        payload: { 
          user: authResponse.user, 
          token: authResponse.token 
        } 
      });
    } catch (error) {
      const message = error && typeof error === 'object' && 'message' in error 
        ? (error as { message: string }).message 
        : 'Login failed';
      dispatch({ type: 'AUTH_FAILURE', payload: message });
      throw error;
    }
  };

  // Logout function
  const logout = async (): Promise<void> => {
    try {
      const { authService } = await import('../services/authService');
      await authService.logout();
    } catch {
      // Ignore logout errors
    } finally {
      dispatch({ type: 'AUTH_LOGOUT' });
    }
  };

  // Clear error function
  const clearError = (): void => {
    dispatch({ type: 'AUTH_CLEAR_ERROR' });
  };

  // Refresh token function
  const refreshToken = async (): Promise<boolean> => {
    try {
      const { authService } = await import('../services/authService');
      const refreshResponse = await authService.refreshToken();
      
      if (refreshResponse && refreshResponse.access_token) {
        // Update user info from new token
        const user = authService.getCurrentUserFromToken();
        if (user) {
          dispatch({ type: 'AUTH_RESTORE', payload: user });
          return true;
        }
      }
      
      await logout();
      return false;
    } catch {
      await logout();
      return false;
    }
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    clearError,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;