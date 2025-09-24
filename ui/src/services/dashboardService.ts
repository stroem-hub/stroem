import { apiClient } from './apiClient';
import type { 
  DashboardSystemStatusResponse,
  DashboardJobMetricsResponse,
  DashboardRecentActivityResponse,
  DashboardJobTrendsResponse,
  JobTrendsParams
} from './apiTypes';
import type { SystemStatus, JobExecutionMetrics, RecentActivity, JobTrendsData } from '../types';

/**
 * Dashboard service for fetching dashboard data and metrics
 */
export class DashboardService {
  /**
   * Get system status information
   */
  async getSystemStatus(): Promise<SystemStatus> {
    const response = await apiClient.get<DashboardSystemStatusResponse>(
      '/api/dashboard/system-status'
    );
    return response.system_status;
  }

  /**
   * Get job execution metrics
   */
  async getJobMetrics(): Promise<JobExecutionMetrics> {
    const response = await apiClient.get<DashboardJobMetricsResponse>(
      '/api/dashboard/job-metrics'
    );
    return response.job_metrics;
  }

  /**
   * Get recent activity (jobs and alerts)
   */
  async getRecentActivity(): Promise<RecentActivity> {
    const response = await apiClient.get<DashboardRecentActivityResponse>(
      '/api/dashboard/recent-activity'
    );
    return response.recent_activity;
  }

  /**
   * Get job trends data
   */
  async getJobTrends(params: JobTrendsParams = {}): Promise<JobTrendsData> {
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
  }

  /**
   * Get all dashboard data in parallel
   */
  async getAllDashboardData(trendsParams: JobTrendsParams = {}): Promise<{
    systemStatus: SystemStatus;
    jobMetrics: JobExecutionMetrics;
    recentActivity: RecentActivity;
    jobTrends: JobTrendsData;
  }> {
    const [systemStatus, jobMetrics, recentActivity, jobTrends] = await Promise.all([
      this.getSystemStatus(),
      this.getJobMetrics(),
      this.getRecentActivity(),
      this.getJobTrends(trendsParams),
    ]);

    return {
      systemStatus,
      jobMetrics,
      recentActivity,
      jobTrends,
    };
  }
}

// Create singleton instance
export const dashboardService = new DashboardService();