import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

/**
 * Component to handle OIDC callback after successful authentication
 * This component should be rendered when the user returns from OIDC provider
 */
export const OIDCCallback: React.FC = () => {
  const navigate = useNavigate();
  const { refreshToken } = useAuth();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // The server should have set a refresh token cookie during the callback
        // We need to exchange it for an access token
        const success = await refreshToken();
        
        if (success) {
          // Get the intended destination from session storage or default to dashboard
          const intendedPath = sessionStorage.getItem('auth_redirect') || '/dashboard';
          sessionStorage.removeItem('auth_redirect');
          navigate(intendedPath, { replace: true });
        } else {
          // If refresh fails, redirect to login with error
          navigate('/login?error=callback_failed', { replace: true });
        }
      } catch (error) {
        console.error('OIDC callback error:', error);
        navigate('/login?error=callback_failed', { replace: true });
      }
    };

    handleCallback();
  }, [navigate, refreshToken]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <h2 className="mt-4 text-lg font-medium text-gray-900">
          Completing authentication...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we finish signing you in.
        </p>
      </div>
    </div>
  );
};