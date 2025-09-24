import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';

/**
 * Component to handle OIDC callback after successful authentication
 * This component should be rendered when the user returns from OIDC provider
 */
export const OIDCCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Exchange the OIDC callback for tokens
        const authResponse = await authService.exchangeOidcCallback();

        if (authResponse && authResponse.token && authResponse.user) {
          // Update auth context by dispatching SUCCESS action directly
          const authEvent = new CustomEvent('auth:success', {
            detail: { user: authResponse.user, token: authResponse.token }
          });
          window.dispatchEvent(authEvent);

          // Get the intended destination from session storage or default to dashboard
          const intendedPath = sessionStorage.getItem('auth_redirect') || '/dashboard';
          sessionStorage.removeItem('auth_redirect');

          // Small delay to ensure auth state is updated
          setTimeout(() => {
            navigate(intendedPath, { replace: true });
          }, 100);
        } else {
          // If exchange fails, redirect to login with error
          navigate('/login?error=callback_failed', { replace: true });
        }
      } catch (error) {
        console.error('OIDC callback error:', error);
        navigate('/login?error=callback_failed', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

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