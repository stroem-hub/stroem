import { useState, useEffect } from 'react';
import { dashboardService } from '../../services/dashboardService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Alert } from '../ui/Alert';
import { LineChart, AreaChart } from '../ui/Chart';
import type { JobTrendsData, TimeRange, AppError, TimeSeriesDataPoint } from '../../types';

export interface JobTrendsWidgetProps {
  className?: string;
  refreshInterval?: number;
  defaultRange?: TimeRange;
  showSuccessFailure?: boolean;
}

const TIME_RANGE_OPTIONS: Array<{ value: TimeRange; label: string }> = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
];

export function JobTrendsWidget({
  className = '',
  refreshInterval = 60000, // 1 minute
  defaultRange = '24h',
  showSuccessFailure = true,
}: JobTrendsWidgetProps) {
  const [data, setData] = useState<JobTrendsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(defaultRange);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async (range: TimeRange, skipCache = false) => {
    try {
      setError(null);
      if (!skipCache) {
        setLoading(true);
      }
      
      const trendsData = await dashboardService.getJobTrends({ range }, { skipCache });
      setData(trendsData);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Failed to fetch job trends:', err);
      setError(err as AppError);
    } finally {
      setLoading(false);
    }
  };

  const handleRangeChange = (range: TimeRange) => {
    setSelectedRange(range);
    fetchData(range);
  };

  const handleRefresh = () => {
    fetchData(selectedRange, true);
  };

  useEffect(() => {
    fetchData(selectedRange);
  }, []);

  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchData(selectedRange);
      }, refreshInterval);

      return () => clearInterval(interval);
    }
    return undefined;
  }, [refreshInterval, selectedRange]);

  const formatTimestamp = (timestamp: string, range: TimeRange): string => {
    const date = new Date(timestamp);
    
    switch (range) {
      case '1h':
      case '6h':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '24h':
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      case '7d':
        return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      case '30d':
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
      default:
        return date.toLocaleString();
    }
  };

  const prepareChartData = (): {
    totalJobs: TimeSeriesDataPoint[];
    successfulJobs: TimeSeriesDataPoint[];
    failedJobs: TimeSeriesDataPoint[];
  } => {
    if (!data || !data.time_series) {
      return { totalJobs: [], successfulJobs: [], failedJobs: [] };
    }

    return {
      totalJobs: data.time_series.map(point => ({
        timestamp: point.timestamp,
        value: point.total_jobs,
        label: formatTimestamp(point.timestamp, selectedRange),
      })),
      successfulJobs: data.time_series.map(point => ({
        timestamp: point.timestamp,
        value: point.successful_jobs,
        label: formatTimestamp(point.timestamp, selectedRange),
      })),
      failedJobs: data.time_series.map(point => ({
        timestamp: point.timestamp,
        value: point.failed_jobs,
        label: formatTimestamp(point.timestamp, selectedRange),
      })),
    };
  };

  const calculateSummaryStats = () => {
    if (!data || !data.time_series || data.time_series.length === 0) {
      return {
        totalJobs: 0,
        successfulJobs: 0,
        failedJobs: 0,
        successRate: 0,
        trend: 'stable' as 'up' | 'down' | 'stable',
      };
    }

    const totalJobs = data.time_series.reduce((sum, point) => sum + point.total_jobs, 0);
    const successfulJobs = data.time_series.reduce((sum, point) => sum + point.successful_jobs, 0);
    const failedJobs = data.time_series.reduce((sum, point) => sum + point.failed_jobs, 0);
    const successRate = totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 0;

    // Calculate trend based on first and last data points
    const firstPoint = data.time_series[0];
    const lastPoint = data.time_series[data.time_series.length - 1];
    let trend: 'up' | 'down' | 'stable' = 'stable';
    
    if (firstPoint && lastPoint) {
      const firstTotal = firstPoint.total_jobs;
      const lastTotal = lastPoint.total_jobs;
      const change = ((lastTotal - firstTotal) / (firstTotal || 1)) * 100;
      
      if (change > 10) {
        trend = 'up';
      } else if (change < -10) {
        trend = 'down';
      }
    }

    return {
      totalJobs,
      successfulJobs,
      failedJobs,
      successRate,
      trend,
    };
  };

  const formatRelativeTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`;
    } else {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      return `${diffHours}h ago`;
    }
  };

  const chartData = prepareChartData();
  const stats = calculateSummaryStats();

  if (loading && !data) {
    return (
      <Card className={className}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Job Trends</h3>
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" role="status" aria-label="Loading"></div>
          </div>
          <div className="animate-pulse">
            <div className="h-48 bg-gray-200 rounded mb-4"></div>
            <div className="flex space-x-4">
              {Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="h-8 bg-gray-200 rounded flex-1"></div>
              ))}
            </div>
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
            <h3 className="text-lg font-semibold text-gray-900">Job Trends</h3>
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
            title="Failed to load job trends"
          >
            {error.message}
          </Alert>
        </div>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Job Trends</h3>
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

        {/* Time Range Selector */}
        <div className="flex flex-wrap gap-2 mb-6">
          {TIME_RANGE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              variant={selectedRange === option.value ? 'primary' : 'outline'}
              size="sm"
              onClick={() => handleRangeChange(option.value)}
              disabled={loading}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.totalJobs}</div>
            <div className="text-sm text-gray-500">Total Jobs</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{stats.successfulJobs}</div>
            <div className="text-sm text-gray-500">Successful</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{stats.failedJobs}</div>
            <div className="text-sm text-gray-500">Failed</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center space-x-1">
              <div className="text-2xl font-bold text-gray-900">
                {stats.successRate.toFixed(1)}%
              </div>
              {stats.trend === 'up' && (
                <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              )}
              {stats.trend === 'down' && (
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="text-sm text-gray-500">Success Rate</div>
          </div>
        </div>

        {/* Charts */}
        {chartData.totalJobs.length > 0 ? (
          <div className="space-y-6">
            {/* Total Jobs Chart */}
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-3">Total Job Executions</h4>
              <AreaChart
                data={chartData.totalJobs}
                width={600}
                height={200}
                color="#3b82f6"
                fillOpacity={0.1}
                strokeWidth={2}
                showGrid={true}
                className="w-full"
              />
            </div>

            {/* Success/Failure Comparison */}
            {showSuccessFailure && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-3">Success vs Failure Trends</h4>
                <div className="relative">
                  <LineChart
                    data={chartData.successfulJobs}
                    width={600}
                    height={200}
                    color="#10b981"
                    strokeWidth={2}
                    showDots={false}
                    showGrid={true}
                    className="w-full absolute"
                  />
                  <LineChart
                    data={chartData.failedJobs}
                    width={600}
                    height={200}
                    color="#ef4444"
                    strokeWidth={2}
                    showDots={false}
                    showGrid={false}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-center space-x-6 mt-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Successful Jobs</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm text-gray-600">Failed Jobs</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No trend data available for the selected time range
          </div>
        )}
      </div>
    </Card>
  );
}