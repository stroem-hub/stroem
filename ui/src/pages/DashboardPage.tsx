import React from 'react';
import { useAuth } from '../hooks/useAuth';

export const DashboardPage: React.FC = () => {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Strøm Dashboard
              </h1>
              <p className="text-sm text-gray-600">
                Welcome back, {user?.name || user?.email}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Dashboard Content
              </h2>
              <p className="text-gray-600 mb-6">
                This is a placeholder for the dashboard content. The authentication system is working!
              </p>
              
              <div className="bg-green-50 border border-green-200 rounded-md p-4 max-w-md mx-auto">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-green-800">
                      Authentication system is working correctly!
                    </p>
                  </div>
                </div>
              </div>

              {user && (
                <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
                  <h3 className="text-sm font-medium text-blue-800 mb-2">User Information</h3>
                  <div className="text-sm text-blue-700 space-y-1">
                    <p><strong>ID:</strong> {user.user_id}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                    {user.name && <p><strong>Name:</strong> {user.name}</p>}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};