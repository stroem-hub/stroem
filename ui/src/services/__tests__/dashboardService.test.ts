import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService } from '../dashboardService';
import { apiClient } from '../apiClient';
import type { SystemStatus, JobExecutionMetrics, RecentActivity, JobTrendsData } from '../../types';

// Mock the API client
vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    service = new DashboardService({
      systemStatusTTL: 1000, // 1 second for testing
      jobMetricsTTL: 1000,
      recentActivityTTL: 1000,
      jobTrendsTTL: 1000,
      maxRetries: 2,
      retryDelay: 100,
      retryBackoffMultiplier: 2,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    service.clearAllCache();
  });

  describe('getSystemStatus', () => {
    const mockSystemStatus: SystemStatus = {
      active_workers: 2,
      idle_workers: 1,
      total_jobs_today: 10,
      system_uptime: '2 days',
      average_execution_time_24h: 120,
      alerts: [],
    };

    it('should fetch system status successfully', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        system_status: mockSystemStatus,
      });

      const result = await service.getSystemStatus();

      expect(result).toEqual(mockSystemStatus);
      expect(mockApiClient.get).toHaveBeenCalledWith('/api/dashboard/system-status');
    });

    it('should use cached data on subsequent calls', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        system_status: mockSystemStatus,
      });

      // First call
      const result1 = await service.getSystemStatus();
      expect(result1).toEqual(mockSystemStatus);

      // Second call should use cache
      const result2 = await service.getSystemStatus();
      expect(result2).toEqual(mockSystemStatus);

      // API should only be called once
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when requested', async () => {
      mockApiClient.get
        .mockResolvedValueOnce({ system_status: mockSystemStatus })
        .mockResolvedValueOnce({ system_status: { ...mockSystemStatus, active_workers: 3 } });

      // First call
      await service.getSystemStatus();

      // Second call with skipCache
      const result = await service.getSystemStatus({ skipCache: true });

      expect(result.active_workers).toBe(3);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure', async () => {
      const error = { type: 'network', message: 'Network error', recoverable: true };
      
      mockApiClient.get
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ system_status: mockSystemStatus });

      const result = await service.getSystemStatus();

      expect(result).toEqual(mockSystemStatus);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should throw error after max retries', async () => {
      const error = { type: 'network', message: 'Network error', recoverable: true };
      
      mockApiClient.get.mockRejectedValue(error);

      await expect(service.getSystemStatus()).rejects.toEqual(error);
      expect(mockApiClient.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('getAllDashboardData', () => {
    const mockData = {
      systemStatus: {
        active_workers: 2,
        idle_workers: 1,
        total_jobs_today: 10,
        system_uptime: '2 days',
        average_execution_time_24h: 120,
        alerts: [],
      },
      jobMetrics: {
        today: {
          total_jobs: 10,
          success_count: 8,
          failure_count: 2,
          success_rate: 0.8,
        },
        status_distribution: {
          running: 1,
          completed: 8,
          failed: 1,
          queued: 0,
        },
        top_failing_workflows: [],
        average_execution_time: 120,
      },
      recentActivity: {
        recent_jobs: [],
        recent_alerts: [],
      },
      jobTrends: {
        time_series: [],
      },
    };

    it('should fetch all dashboard data successfully', async () => {
      mockApiClient.get
        .mockResolvedValueOnce({ system_status: mockData.systemStatus })
        .mockResolvedValueOnce({ job_metrics: mockData.jobMetrics })
        .mockResolvedValueOnce({ recent_activity: mockData.recentActivity })
        .mockResolvedValueOnce({ job_trends: mockData.jobTrends });

      const result = await service.getAllDashboardData();

      expect(result.systemStatus).toEqual(mockData.systemStatus);
      expect(result.jobMetrics).toEqual(mockData.jobMetrics);
      expect(result.recentActivity).toEqual(mockData.recentActivity);
      expect(result.jobTrends).toEqual(mockData.jobTrends);
      expect(Object.keys(result.errors)).toHaveLength(0);
    });

    it('should handle partial failures gracefully', async () => {
      const error = { type: 'network', message: 'Network error', recoverable: true };
      
      mockApiClient.get
        .mockResolvedValueOnce({ system_status: mockData.systemStatus })
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce({ recent_activity: mockData.recentActivity })
        .mockResolvedValueOnce({ job_trends: mockData.jobTrends });

      const result = await service.getAllDashboardData();

      expect(result.systemStatus).toEqual(mockData.systemStatus);
      expect(result.jobMetrics).toBeNull();
      expect(result.recentActivity).toEqual(mockData.recentActivity);
      expect(result.jobTrends).toEqual(mockData.jobTrends);
      expect(result.errors.jobMetrics).toEqual(error);
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      const mockSystemStatus: SystemStatus = {
        active_workers: 2,
        idle_workers: 1,
        total_jobs_today: 10,
        system_uptime: '2 days',
        average_execution_time_24h: 120,
        alerts: [],
      };

      mockApiClient.get.mockResolvedValueOnce({
        system_status: mockSystemStatus,
      });

      await service.getSystemStatus();

      const stats = service.getCacheStats();
      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(1);
      expect(stats.expiredEntries).toBe(0);
    });

    it('should clean up expired cache entries', async () => {
      const mockSystemStatus: SystemStatus = {
        active_workers: 2,
        idle_workers: 1,
        total_jobs_today: 10,
        system_uptime: '2 days',
        average_execution_time_24h: 120,
        alerts: [],
      };

      mockApiClient.get.mockResolvedValueOnce({
        system_status: mockSystemStatus,
      });

      await service.getSystemStatus();

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 1100));

      const cleanedCount = service.cleanupExpiredCache();
      expect(cleanedCount).toBe(1);

      const stats = service.getCacheStats();
      expect(stats.totalEntries).toBe(0);
    });
  });
});