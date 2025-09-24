import { useContext } from 'react';
import AuthContext from '../contexts/AuthContext';

/**
 * Custom hook for accessing authentication state and methods
 * This is a re-export of the useAuth hook from AuthContext for convenience
 */
export { useAuth } from '../contexts/AuthContext';

/**
 * Hook for checking if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useIsAuthenticated must be used within an AuthProvider');
  }
  return context.isAuthenticated;
};

/**
 * Hook for getting current user
 */
export const useCurrentUser = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useCurrentUser must be used within an AuthProvider');
  }
  return context.user;
};

/**
 * Hook for authentication loading state
 */
export const useAuthLoading = (): boolean => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthLoading must be used within an AuthProvider');
  }
  return context.isLoading;
};

/**
 * Hook for authentication error state
 */
export const useAuthError = (): string | null => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthError must be used within an AuthProvider');
  }
  return context.error;
};