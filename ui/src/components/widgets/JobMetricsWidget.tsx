import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { Spinner, Skeleton } from '../ui/Loading';
import { DonutChart } from '../ui/Chart';
import { dashboardService } from '../../services/dashboardService';
import type { JobExecutionMetrics, AppError, ChartDataPoint } from '../../types';
import { cn } from '../../utils';

export interface JobMetricsWidgetProps {
  className?: string;
  refreshInterval?: number; // in milliseconds, default 60 seconds
  onError?: (error: AppError) => void;
  onWorkflowClick?: (workflowName: string) => void;
}

interface TodayMetricsProps {
  metrics: JobExecutionMetrics['today'];
  isLoading?: boolean;
}

interface StatusDistributionProps {
  distribution: JobExecutionMetrics['status_distribution'];
  isLoading?: boolean;
}

interface TopFailingWorkflowsProps {
  workflows: JobExecutionMetrics['top_failing_workflows'];
  isLoading?: boolean;
  onWorkflowClick?: (workflowName: string) => void;
}

const TodayMetrics: React.FC<TodayMetricsProps> = ({ metrics, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton height={16} width="60%" />
            <Skeleton height={24} width="80%" />
          </div>
        ))}
      </div>
    );
  }

  const formatSuccessRate = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getSuccessRateColor = (rate: number): string => {
    if (rate >= 0.95) return 'text-green-600';
    if (rate >= 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-600">Today's Metrics</h4>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <span className="text-xs text-gray-500">Total Jobs</span>
          <div className="text-xl font-semibold text-gray-900">{metrics.total_jobs}</div>
        </div>
        
        <div className="space-y-1">
          <span className="text-xs text-gray-500">Success Rate</span>
          <div className={`text-xl font-semibold ${getSuccessRateColor(metrics.success_rate)}`}>
            {formatSuccessRate(metrics.success_rate)}
          </div>
        </div>
        
        <div className="space-y-1">
          <span className="text-xs text-gray-500">Successful</span>
          <div className="text-lg font-medium text-green-600">{metrics.success_count}</div>
        </div>
        
        <div className="space-y-1">
          <span className="text-xs text-gray-500">Failed</span>
          <div className="text-lg font-medium text-red-600">{metrics.failure_count}</div>
        </div>
      </div>
    </div>
  );
};

const StatusDistribution: React.FC<StatusDistributionProps> = ({ distribution, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton height={16} width="50%" />
        <div className="flex justify-center">
          <Skeleton height={150} width={150} className="rounded-full" />
        </div>
      </div>
    );
  }

  const chartData: ChartDataPoint[] = [
    {
      label: 'Completed',
      value: distribution.completed,
      color: '#10b981', // green-500
    },
    {
      label: 'Running',
      value: distribution.running,
      color: '#3b82f6', // blue-500
    },
    {
      label: 'Failed',
      value: distribution.failed,
      color: '#ef4444', // red-500
    },
    {
      label: 'Queued',
      value: distribution.queued,
      color: '#6b7280', // gray-500
    },
  ].filter(item => item.value > 0); // Only show statuses with jobs

  const totalJobs = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  if (totalJobs === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-600">Status Distribution</h4>
        <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
          No jobs to display
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-600">Status Distribution</h4>
      <div className="flex justify-center">
        <DonutChart
          data={chartData}
          size={150}
          innerRadius={0.6}
          showLegend={false}
          showLabels={true}
        />
      </div>
      
      {/* Status legend */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {chartData.map((item) => (
          <div key={item.label} className="flex items-center space-x-2">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-gray-600">{item.label}</span>
            <span className="ml-auto font-medium">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const TopFailingWorkflows: React.FC<TopFailingWorkflowsProps> = ({ 
  workflows, 
  isLoading = false,
  onWorkflowClick 
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton height={16} width="60%" />
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton height={16} width="40%" />
              <Skeleton height={16} width="20%" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-600">Top Failing Workflows</h4>
        <div className="text-sm text-gray-500 text-center py-2">
          No failing workflows
        </div>
      </div>
    );
  }

  const formatFailureRate = (rate: number): string => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getFailureRateColor = (rate: number): string => {
    if (rate >= 0.5) return 'text-red-600';
    if (rate >= 0.2) return 'text-yellow-600';
    return 'text-orange-600';
  };

  return (
    <div className="space-y-4">
      <h4 className="text-sm font-medium text-gray-600">Top Failing Workflows</h4>
      <div className="space-y-2 max-h-32 overflow-y-auto">
        {workflows.map((workflow, index) => (
          <div
            key={workflow.name}
            className={cn(
              "flex items-center justify-between p-2 rounded-lg border border-gray-200",
              onWorkflowClick && "cursor-pointer hover:bg-gray-50 transition-colors"
            )}
            onClick={() => onWorkflowClick?.(workflow.name)}
            role={onWorkflowClick ? "button" : undefined}
            tabIndex={onWorkflowClick ? 0 : undefined}
            onKeyDown={(e) => {
              if (onWorkflowClick && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onWorkflowClick(workflow.name);
              }
            }}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400 font-mono">#{index + 1}</span>
                <span className="text-sm font-medium text-gray-900 truncate">
                  {workflow.name}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                {workflow.failure_count} failures
              </div>
            </div>
            <div className="text-right">
              <div className={`text-sm font-medium ${getFailureRateColor(workflow.failure_rate)}`}>
                {formatFailureRate(workflow.failure_rate)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const JobMetricsWidget: React.FC<JobMetricsWidgetProps> = ({
  className,
  refreshInterval = 60000, // 60 seconds default
  onError,
  onWorkflowClick,
}) => {
  const [jobMetrics, setJobMetrics] = useState<JobExecutionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchJobMetrics = useCallback(async (skipCache = false) => {
    try {
      setError(null);
      if (!skipCache) {
        setIsLoading(true);
      } else {
        setIsRefreshing(true);
      }

      const metrics = await dashboardService.getJobMetrics({ skipCache });
      setJobMetrics(metrics);
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
    fetchJobMetrics(true);
  }, [fetchJobMetrics]);

  const handleRefresh = useCallback(() => {
    fetchJobMetrics(true);
  }, [fetchJobMetrics]);

  // Initial load
  useEffect(() => {
    fetchJobMetrics();
  }, [fetchJobMetrics]);

  // Auto-refresh interval
  useEffect(() => {
    if (refreshInterval <= 0) return;

    const interval = setInterval(() => {
      fetchJobMetrics(true);
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchJobMetrics, refreshInterval]);

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
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Job Metrics</h3>
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
              aria-label="Refresh job metrics"
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
            <Alert variant="error" title="Failed to load job metrics">
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
          {/* Today's Metrics */}
          <TodayMetrics
            metrics={jobMetrics?.today ?? {
              total_jobs: 0,
              success_count: 0,
              failure_count: 0,
              success_rate: 0,
            }}
            isLoading={isLoading}
          />

          {/* Average Execution Time */}
          {jobMetrics && !isLoading && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-600">Average Execution Time</h4>
              <div className="text-lg font-semibold text-gray-900">
                {formatExecutionTime(jobMetrics.average_execution_time)}
              </div>
            </div>
          )}

          {/* Status Distribution */}
          <StatusDistribution
            distribution={jobMetrics?.status_distribution ?? {
              running: 0,
              completed: 0,
              failed: 0,
              queued: 0,
            }}
            isLoading={isLoading}
          />

          {/* Top Failing Workflows */}
          <TopFailingWorkflows
            workflows={jobMetrics?.top_failing_workflows ?? []}
            isLoading={isLoading}
            {...(onWorkflowClick && { onWorkflowClick })}
          />
        </div>
      </CardContent>
    </Card>
  );
};

JobMetricsWidget.displayName = 'JobMetricsWidget';