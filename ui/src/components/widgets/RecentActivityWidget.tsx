import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import type { RecentActivity, Job, Alert as AlertType, AppError } from '../../types';

export interface RecentActivityWidgetProps {
  className?: string;
  refreshInterval?: number;
  maxItems?: number;
}

export function RecentActivityWidget({
  className = '',
  refreshInterval = 30000, // 30 seconds
  maxItems = 10,
}: RecentActivityWidgetProps) {
  const [data, setData] = useState<RecentActivity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (skipCache = false) => {
    try {
      setError(null);
      if (!skipCache) {
        setLoading(true);
      }
      
      const recentActivity = await dashboardService.getRecentActivity({ skipCache });
      setData(recentActivity);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch recent activity:', err);
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchData(true);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData();
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshInterval]);

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const getJobStatusColor = (status: Job['status']): 'success' | 'error' | 'warning' | 'info' => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      case 'running':
        return 'warning';
      case 'queued':
        return 'info';
      default:
        return 'info';
    }
  };

  const getAlertTypeColor = (type: AlertType['type']): 'success' | 'error' | 'warning' | 'info' => {
    switch (type) {
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'info';
    }
  };

  if (loading && !data) {
    return (
      <Card className={className}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" role="status" aria-label="Loading"></div>
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center space-x-3">
                  <div className="w-3 h-3 bg-gray-200 rounded-full"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-1"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-6 bg-gray-200 rounded"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
            >
              Retry
            </Button>
          </div>
          <Alert
            variant="error"
            title="Failed to load recent activity"
          >
            {error.message}
          </Alert>
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card className={className}>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="text-center py-8 text-gray-500">
            No recent activity data available
          </div>
        </div>
      </Card>
    );
  }

  const recentJobs = data.recent_jobs.slice(0, maxItems);
  const recentAlerts = data.recent_alerts.slice(0, maxItems);
  const hasActivity = recentJobs.length > 0 || recentAlerts.length > 0;

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <div className="flex items-center space-x-2">
            {lastUpdated && (
              <span className="text-xs text-gray-500">
                Updated {formatRelativeTime(lastUpdated.toISOString())}
              </span>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={loading}
              className="text-xs"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>
        </div>

        {!hasActivity ? (
          <div className="text-center py-8 text-gray-500">
            No recent activity
          </div>
        ) : (
          <div className="space-y-4">
            {/* Recent Jobs */}
            {recentJobs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Jobs</h4>
                <div className="space-y-2">
                  {recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {job.task_name}
                          </span>
                          <Badge variant={getJobStatusColor(job.status)}>
                            {job.status}
                          </Badge>
                        </div>
                        <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                          <span>ID: {job.id.slice(0, 8)}...</span>
                          <span>By: {job.triggered_by}</span>
                          {job.duration && (
                            <span>Duration: {Math.round(job.duration)}s</span>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 ml-2">
                        {formatRelativeTime(job.start_datetime)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Alerts */}
            {recentAlerts.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Recent Alerts</h4>
                <div className="space-y-2">
                  {recentAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className="flex items-start justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Badge variant={getAlertTypeColor(alert.type)}>
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-900 break-words">
                          {alert.message}
                        </p>
                      </div>
                      <div className="text-xs text-gray-500 ml-2 flex-shrink-0">
                        {formatRelativeTime(alert.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}