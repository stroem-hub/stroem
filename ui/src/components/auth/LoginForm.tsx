import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authService } from '../../services/authService';
import type { AuthProvider } from '../../services/apiTypes';

interface LoginFormProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onError }) => {
  const { login, isLoading, error, clearError } = useAuth();
  const [providers, setProviders] = useState<AuthProvider[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [credentials, setCredentials] = useState({
    email: '',
    password: '',
  });
  const [loadingProviders, setLoadingProviders] = useState(true);

  // Load authentication providers on component mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const response = await authService.getProviders();
        const providersArray = Array.isArray(response.providers) ? response.providers : [];
        setProviders(providersArray);
        
        // Auto-select first available provider
        if (providersArray.length > 0 && providersArray[0]) {
          setSelectedProvider(providersArray[0].id);
        }
      } catch (err) {
        console.error('Failed to load auth providers:', err);
        // Set a default internal provider if loading fails
        setProviders([{
          id: 'internal',
          name: 'Internal',
          type: 'internal',
          primary: false,
        }]);
        setSelectedProvider('internal');
      } finally {
        setLoadingProviders(false);
      }
    };

    loadProviders();
  }, []);

  // Clear errors when provider changes
  useEffect(() => {
    if (error) {
      clearError();
    }
  }, [selectedProvider, clearError, error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedProvider) {
      const errorMsg = 'Please select an authentication provider';
      onError?.(errorMsg);
      return;
    }

    const selectedProviderData = Array.isArray(providers) ? providers.find(p => p.id === selectedProvider) : undefined;
    
    try {
      // For OIDC providers, store the current location for redirect after callback
      if (selectedProviderData?.type === 'oidc') {
        const currentPath = window.location.pathname + window.location.search;
        if (currentPath !== '/login') {
          sessionStorage.setItem('auth_redirect', currentPath);
        }
      }

      await login(selectedProvider, credentials);
      
      // Only call onSuccess for non-OIDC providers (OIDC will redirect)
      if (selectedProviderData?.type !== 'oidc') {
        onSuccess?.();
      }
    } catch (err) {
      const errorMsg = err && typeof err === 'object' && 'message' in err 
        ? (err as { message: string }).message 
        : 'Login failed';
      onError?.(errorMsg);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setCredentials(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const selectedProviderData = Array.isArray(providers) ? providers.find(p => p.id === selectedProvider) : undefined;
  const isInternalProvider = selectedProviderData?.type === 'internal';

  if (loadingProviders) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading authentication providers...</span>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Provider Selection */}
        {providers.length > 1 && (
          <div>
            <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-2">
              Authentication Provider
            </label>
            <select
              id="provider"
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              disabled={isLoading}
            >
              <option value="">Select a provider</option>
              {providers.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Internal Provider Credentials */}
        {isInternalProvider && (
          <>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={credentials.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your email"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={credentials.password}
                onChange={(e) => handleInputChange('password', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>
          </>
        )}

        {/* OIDC Provider Info */}
        {selectedProviderData && selectedProviderData.type === 'oidc' && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-blue-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-blue-800">
                You will be redirected to {selectedProviderData.name} to complete authentication.
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading || !selectedProvider || (isInternalProvider && (!credentials.email || !credentials.password))}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Signing in...
            </>
          ) : (
            <>
              {selectedProviderData?.type === 'oidc' ? 'Continue with ' + selectedProviderData.name : 'Sign In'}
            </>
          )}
        </button>
      </form>
    </div>
  );
};