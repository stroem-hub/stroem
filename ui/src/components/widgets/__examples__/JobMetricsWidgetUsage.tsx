import { type FC } from 'react';
import { JobMetricsWidget } from '../JobMetricsWidget';
import type { AppError } from '../../../types';

/**
 * Example usage of JobMetricsWidget component
 */
export const JobMetricsWidgetUsage: FC = () => {
  const handleError = (error: AppError) => {
    console.error('Job metrics error:', error);
    // In a real app, you might show a toast notification or log to an error service
  };

  const handleWorkflowClick = (workflowName: string) => {
    console.log('Clicked workflow:', workflowName);
    // In a real app, you might navigate to the workflow details page
    // or open a modal with workflow information
  };

  return (
    <div className="space-y-8 p-6">
      <h1 className="text-2xl font-bold text-gray-900">Job Metrics Widget Examples</h1>
      
      {/* Basic usage */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Basic Usage</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget />
        </div>
      </section>

      {/* With custom refresh interval */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Custom Refresh Interval (30 seconds)</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget refreshInterval={30000} />
        </div>
      </section>

      {/* With error handling */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">With Error Handling</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget onError={handleError} />
        </div>
      </section>

      {/* With workflow click handler */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">With Workflow Click Handler</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget onWorkflowClick={handleWorkflowClick} />
        </div>
      </section>

      {/* Full featured */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Full Featured</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget
            refreshInterval={45000}
            onError={handleError}
            onWorkflowClick={handleWorkflowClick}
            className="border-2 border-blue-200"
          />
        </div>
      </section>

      {/* Disabled auto-refresh */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Disabled Auto-refresh</h2>
        <div className="w-full max-w-md">
          <JobMetricsWidget
            refreshInterval={0}
            onError={handleError}
            onWorkflowClick={handleWorkflowClick}
          />
        </div>
      </section>

      {/* In a grid layout */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">In Dashboard Grid</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <JobMetricsWidget
            refreshInterval={60000}
            onError={handleError}
            onWorkflowClick={handleWorkflowClick}
          />
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
            <span className="text-gray-500">Other Widget</span>
          </div>
          <div className="bg-gray-100 rounded-lg p-4 flex items-center justify-center">
            <span className="text-gray-500">Another Widget</span>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Example of integrating JobMetricsWidget in a dashboard
 */
export const DashboardWithJobMetrics: FC = () => {
  const handleWorkflowNavigation = (workflowName: string) => {
    // Navigate to workflow details page
    window.location.href = `/workflows/${encodeURIComponent(workflowName)}`;
  };

  const handleMetricsError = (error: AppError) => {
    // Show error notification
    console.error('Dashboard metrics error:', error);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Dashboard</h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {/* Job Metrics Widget */}
          <JobMetricsWidget
            refreshInterval={60000} // Refresh every minute
            onError={handleMetricsError}
            onWorkflowClick={handleWorkflowNavigation}
            className="lg:col-span-1"
          />
          
          {/* Placeholder for other widgets */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">System Status</h3>
            <div className="text-gray-500">System status widget would go here</div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
            <div className="text-gray-500">Recent activity widget would go here</div>
          </div>
        </div>
      </div>
    </div>
  );
};;

export default JobMetricsWidgetUsage;