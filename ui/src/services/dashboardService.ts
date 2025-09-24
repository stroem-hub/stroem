import { apiClient } from './apiClient';
import type { 
  DashboardSystemStatusResponse,
  DashboardJobMetricsResponse,
  DashboardRecentActivityResponse,
  DashboardJobTrendsResponse,
  JobTrendsParams
} from './apiTypes';
import type { SystemStatus, JobExecutionMetrics, RecentActivity, JobTrendsData, AppError } from '../types';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Dashboard service configuration
 */
export interface DashboardServiceConfig {
  // Cache TTL values in milliseconds
  systemStatusTTL: number;
  jobMetricsTTL: number;
  recentActivityTTL: number;
  jobTrendsTTL: number;
  // Retry configuration
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;
}

/**
 * Dashboard service for fetching dashboard data and metrics with caching and error handling
 */
export class DashboardService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: DashboardServiceConfig;

  constructor(config: Partial<DashboardServiceConfig> = {}) {
    this.config = {
      // Default TTL values (in milliseconds)
      systemStatusTTL: 30 * 1000, // 30 seconds - system status changes frequently
      jobMetricsTTL: 60 * 1000, // 1 minute - metrics update regularly
      recentActivityTTL: 15 * 1000, // 15 seconds - activity is very dynamic
      jobTrendsTTL: 5 * 60 * 1000, // 5 minutes - trends change slowly
      // Retry configuration
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      retryBackoffMultiplier: 2,
      ...config,
    };
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache entry
   */
  private clearCache(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute request with retry logic and caching
   */
  private async executeWithRetryAndCache<T>(
    cacheKey: string,
    ttl: number,
    requestFn: () => Promise<T>,
    options: { skipCache?: boolean; maxRetries?: number } = {}
  ): Promise<T> {
    const { skipCache = false, maxRetries = this.config.maxRetries } = options;

    // Try cache first if not skipping
    if (!skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    let lastError: AppError | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await requestFn();
        
        // Cache successful response
        this.setCache(cacheKey, data, ttl);
        
        return data;
      } catch (error) {
        lastError = error as AppError;

        // Don't retry for non-recoverable errors
        if (lastError && !lastError.recoverable) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
        await this.sleep(delay);
      }
    }

    // If all retries failed, throw the last error
    throw lastError || {
      type: 'server' as const,
      message: 'Dashboard request failed after multiple attempts',
      recoverable: true,
    };
  }

  /**
   * Get system status information
   */
  async getSystemStatus(options: { skipCache?: boolean } = {}): Promise<SystemStatus> {
    const cacheKey = this.getCacheKey('/api/dashboard/system-status');
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.systemStatusTTL,
      async () => {
        const response = await apiClient.get<DashboardSystemStatusResponse>(
          '/api/dashboard/system-status'
        );
        return response.system_status;
      },
      options
    );
  }

  /**
   * Get job execution metrics
   */
  async getJobMetrics(options: { skipCache?: boolean } = {}): Promise<JobExecutionMetrics> {
    const cacheKey = this.getCacheKey('/api/dashboard/job-metrics');
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.jobMetricsTTL,
      async () => {
        const response = await apiClient.get<DashboardJobMetricsResponse>(
          '/api/dashboard/job-metrics'
        );
        return response.job_metrics;
      },
      options
    );
  }

  /**
   * Get recent activity (jobs and alerts)
   */
  async getRecentActivity(options: { skipCache?: boolean } = {}): Promise<RecentActivity> {
    const cacheKey = this.getCacheKey('/api/dashboard/recent-activity');
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.recentActivityTTL,
      async () => {
        const response = await apiClient.get<DashboardRecentActivityResponse>(
          '/api/dashboard/recent-activity'
        );
        return response.recent_activity;
      },
      options
    );
  }

  /**
   * Get job trends data
   */
  async getJobTrends(
    params: JobTrendsParams = {},
    options: { skipCache?: boolean } = {}
  ): Promise<JobTrendsData> {
    const cacheKey = this.getCacheKey('/api/dashboard/job-trends', params);
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.jobTrendsTTL,
      async () => {
        const queryParams = new URLSearchParams();
        
        if (params.range) {
          queryParams.append('range', params.range);
        }
        if (params.granularity) {
          queryParams.append('granularity', params.granularity);
        }

        const endpoint = `/api/dashboard/job-trends${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
        const response = await apiClient.get<DashboardJobTrendsResponse>(endpoint);
        return response.job_trends;
      },
      options
    );
  }

  /**
   * Get all dashboard data in parallel with error handling
   */
  async getAllDashboardData(
    trendsParams: JobTrendsParams = {},
    options: { skipCache?: boolean; failFast?: boolean } = {}
  ): Promise<{
    systemStatus: SystemStatus | null;
    jobMetrics: JobExecutionMetrics | null;
    recentActivity: RecentActivity | null;
    jobTrends: JobTrendsData | null;
    errors: Record<string, AppError>;
  }> {
    const { failFast = false } = options;
    const errors: Record<string, AppError> = {};

    if (failFast) {
      // Fail fast - if any request fails, throw immediately
      const [systemStatus, jobMetrics, recentActivity, jobTrends] = await Promise.all([
        this.getSystemStatus(options),
        this.getJobMetrics(options),
        this.getRecentActivity(options),
        this.getJobTrends(trendsParams, options),
      ]);

      return {
        systemStatus,
        jobMetrics,
        recentActivity,
        jobTrends,
        errors,
      };
    } else {
      // Graceful degradation - collect all results and errors
      const results = await Promise.allSettled([
        this.getSystemStatus(options),
        this.getJobMetrics(options),
        this.getRecentActivity(options),
        this.getJobTrends(trendsParams, options),
      ]);

      const [systemStatusResult, jobMetricsResult, recentActivityResult, jobTrendsResult] = results;

      return {
        systemStatus: systemStatusResult.status === 'fulfilled' ? systemStatusResult.value : null,
        jobMetrics: jobMetricsResult.status === 'fulfilled' ? jobMetricsResult.value : null,
        recentActivity: recentActivityResult.status === 'fulfilled' ? recentActivityResult.value : null,
        jobTrends: jobTrendsResult.status === 'fulfilled' ? jobTrendsResult.value : null,
        errors: {
          ...(systemStatusResult.status === 'rejected' && { systemStatus: systemStatusResult.reason }),
          ...(jobMetricsResult.status === 'rejected' && { jobMetrics: jobMetricsResult.reason }),
          ...(recentActivityResult.status === 'rejected' && { recentActivity: recentActivityResult.reason }),
          ...(jobTrendsResult.status === 'rejected' && { jobTrends: jobTrendsResult.reason }),
        },
      };
    }
  }

  /**
   * Refresh specific dashboard data (bypass cache)
   */
  async refreshSystemStatus(): Promise<SystemStatus> {
    return this.getSystemStatus({ skipCache: true });
  }

  async refreshJobMetrics(): Promise<JobExecutionMetrics> {
    return this.getJobMetrics({ skipCache: true });
  }

  async refreshRecentActivity(): Promise<RecentActivity> {
    return this.getRecentActivity({ skipCache: true });
  }

  async refreshJobTrends(params: JobTrendsParams = {}): Promise<JobTrendsData> {
    return this.getJobTrends(params, { skipCache: true });
  }

  /**
   * Refresh all dashboard data (bypass cache)
   */
  async refreshAllDashboardData(
    trendsParams: JobTrendsParams = {},
    options: { failFast?: boolean } = {}
  ): Promise<{
    systemStatus: SystemStatus | null;
    jobMetrics: JobExecutionMetrics | null;
    recentActivity: RecentActivity | null;
    jobTrends: JobTrendsData | null;
    errors: Record<string, AppError>;
  }> {
    return this.getAllDashboardData(trendsParams, { skipCache: true, ...options });
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    entries: Array<{
      key: string;
      timestamp: number;
      ttl: number;
      isExpired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries: Array<{
      key: string;
      timestamp: number;
      ttl: number;
      isExpired: boolean;
    }> = [];

    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl;
      
      entries.push({
        key,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        isExpired,
      });

      if (isExpired) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      entries,
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}

// Create singleton instance with default configuration
export const dashboardService = new DashboardService();