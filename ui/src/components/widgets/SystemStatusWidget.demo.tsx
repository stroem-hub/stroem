import React from 'react';
import { SystemStatusWidget } from './SystemStatusWidget';
import type { AppError } from '../../types';

/**
 * Demo component for SystemStatusWidget
 * This can be used for testing and development
 */
export const SystemStatusWidgetDemo: React.FC = () => {
  const handleError = (error: AppError) => {
    console.error('SystemStatusWidget error:', error);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">
          System Status Widget Demo
        </h1>
        
        <div className="space-y-6">
          {/* Default widget */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Default Configuration
            </h2>
            <SystemStatusWidget onError={handleError} />
          </div>

          {/* Widget with custom refresh interval */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Fast Refresh (10 seconds)
            </h2>
            <SystemStatusWidget 
              refreshInterval={10000}
              onError={handleError}
            />
          </div>

          {/* Widget with no auto-refresh */}
          <div>
            <h2 className="text-lg font-semibold text-gray-700 mb-3">
              Manual Refresh Only
            </h2>
            <SystemStatusWidget 
              refreshInterval={0}
              onError={handleError}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

SystemStatusWidgetDemo.displayName = 'SystemStatusWidgetDemo';