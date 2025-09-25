import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Spinner, Skeleton } from '../ui/Loading';
import { dashboardService } from '../../services/dashboardService';
import type { SystemStatus, AppError } from '../../types';
import { cn } from '../../utils';

export interface SystemStatusWidgetProps {
  className?: string;
  refreshInterval?: number; // in milliseconds, default 30 seconds
  onError?: (error: AppError) => void;
}

interface WorkerStatusProps {
  activeWorkers: number;
  idleWorkers: number;
  isLoading?: boolean;
}

interface UptimeDisplayProps {
  uptime: string;
  isLoading?: boolean;
}

interface JobsCountProps {
  totalJobs: number;
  averageExecutionTime: number;
  isLoading?: boolean;
}

const WorkerStatus: React.FC<WorkerStatusProps> = ({ 
  activeWorkers, 
  idleWorkers, 
  isLoading = false 
}) => {
  const totalWorkers = activeWorkers + idleWorkers;
  
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton height={20} width="60%" />
        <Skeleton height={16} width="80%" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Workers</span>
        <span className="text-lg font-semibold text-gray-900">{totalWorkers}</span>
      </div>
      <div className="flex items-center space-x-4 text-sm">
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
          <span className="text-gray-600">Active: {activeWorkers}</span>
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
          <span className="text-gray-600">Idle: {idleWorkers}</span>
        </div>
      </div>
    </div>
  );
};

const UptimeDisplay: React.FC<UptimeDisplayProps> = ({ uptime, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton height={20} width="50%" />
        <Skeleton height={16} width="70%" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">System Uptime</span>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm text-green-600 font-medium">Online</span>
        </div>
      </div>
      <div className="text-lg font-semibold text-gray-900">{uptime}</div>
    </div>
  );
};

const JobsCount: React.FC<JobsCountProps> = ({ 
  totalJobs, 
  averageExecutionTime, 
  isLoading = false 
}) => {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton height={20} width="70%" />
        <Skeleton height={16} width="60%" />
      </div>
    );
  }

  const formatExecutionTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    } else if (seconds < 3600) {
      return `${(seconds / 60).toFixed(1)}m`;
    } else {
      return `${(seconds / 3600).toFixed(1)}h`;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-600">Jobs Today</span>
        <span className="text-lg font-semibold text-gray-900">{totalJobs}</span>
      </div>
      <div className="text-sm text-gray-600">
        Avg. execution: {formatExecutionTime(averageExecutionTime)}
      </div>
    </div>
  );
};

export const SystemStatusWidget: React.FC<SystemStatusWidgetProps> = ({
  className,
  refreshInterval = 30000, // 30 seconds default
  onError,
}) => {
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchSystemStatus = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      if (!skipCache) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const status = await dashboardService.getSystemStatus({ skipCache });
      setSystemStatus(status);
      setLastUpdated(new Date());
    } catch (err) {
      const appError = err as AppError;
      setError(appError);
      onError?.(appError);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [onError]);

  const handleRetry = useCallback(() => {
    fetchSystemStatus(true);
  }, [fetchSystemStatus]);

  const handleRefresh = useCallback(() => {
    fetchSystemStatus(true);
  }, [fetchSystemStatus]);

  // Initial load
  useEffect(() => {
    fetchSystemStatus();
  }, [fetchSystemStatus]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchSystemStatus(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchSystemStatus, refreshInterval]);

  const formatLastUpdated = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`;
    } else if (diffSeconds < 3600) {
      return `${Math.floor(diffSeconds / 60)}m ago`;
    } else {
      return `${Math.floor(diffSeconds / 3600)}h ago`;
    }
  };

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">System Status</h3>
          <div className="flex items-center space-x-2">
            {lastUpdated && !isLoading && (
              <span className="text-xs text-gray-500">
                {formatLastUpdated(lastUpdated)}
              </span>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading || isRefreshing}
              className="p-1"
              aria-label="Refresh system status"
            >
              {isRefreshing ? (
                <Spinner size="sm" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {error && (
          <div className="mb-4">
            <Alert variant="error" title="Failed to load system status">
              <div className="space-y-2">
                <p>{error.message}</p>
                {error.recoverable && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetry}
                    disabled={isLoading || isRefreshing}
                  >
                    {isRefreshing ? (
                      <>
                        <Spinner size="sm" />
                        <span className="ml-2">Retrying...</span>
                      </>
                    ) : (
                      'Retry'
                    )}
                  </Button>
                )}
              </div>
            </Alert>
          </div>
        )}

        <div className="space-y-6">
          {/* Worker Status */}
          <WorkerStatus
            activeWorkers={systemStatus?.active_workers ?? 0}
            idleWorkers={systemStatus?.idle_workers ?? 0}
            isLoading={isLoading}
          />

          {/* System Uptime */}
          <UptimeDisplay
            uptime={systemStatus?.system_uptime ?? ''}
            isLoading={isLoading}
          />

          {/* Jobs Count */}
          <JobsCount
            totalJobs={systemStatus?.total_jobs_today ?? 0}
            averageExecutionTime={systemStatus?.average_execution_time_24h ?? 0}
            isLoading={isLoading}
          />

          {/* System Alerts */}
          {systemStatus?.alerts && systemStatus.alerts.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600">System Alerts</h4>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {systemStatus.alerts.map((alert) => (
                  <Alert
                    key={alert.id}
                    variant={alert.type === 'error' ? 'error' : alert.type === 'warning' ? 'warning' : 'info'}
                    className="text-xs"
                  >
                    <div className="flex items-start justify-between">
                      <span className="flex-1">{alert.message}</span>
                      <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* No alerts message */}
          {systemStatus?.alerts && systemStatus.alerts.length === 0 && !isLoading && (
            <div className="text-sm text-gray-500 text-center py-2">
              No system alerts
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

SystemStatusWidget.displayName = 'SystemStatusWidget';