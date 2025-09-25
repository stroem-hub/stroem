/**
 * Example usage of the enhanced DashboardService
 * This file demonstrates how to use the dashboard service with caching and error handling
 */

import { dashboardService, DashboardService } from '../dashboardService';
import type { DashboardServiceConfig } from '../dashboardService';

// Example 1: Using the default singleton instance
export async function basicDashboardUsage() {
  try {
    // Get system status (will be cached for 30 seconds by default)
    const systemStatus = await dashboardService.getSystemStatus();
    console.log('System Status:', systemStatus);

    // Get job metrics (will be cached for 1 minute by default)
    const jobMetrics = await dashboardService.getJobMetrics();
    console.log('Job Metrics:', jobMetrics);

    // Get all dashboard data at once with graceful error handling
    const allData = await dashboardService.getAllDashboardData();
    
    if (allData.systemStatus) {
      console.log('System Status loaded successfully');
    }
    
    if (allData.errors['systemStatus']) {
      console.error('Failed to load system status:', allData.errors['systemStatus']);
    }

  } catch (error) {
    console.error('Dashboard error:', error);
  }
}

// Example 2: Using custom configuration
export function createCustomDashboardService() {
  const customConfig: DashboardServiceConfig = {
    // Custom cache TTL values (in milliseconds)
    systemStatusTTL: 10 * 1000, // 10 seconds
    jobMetricsTTL: 30 * 1000, // 30 seconds
    recentActivityTTL: 5 * 1000, // 5 seconds
    jobTrendsTTL: 2 * 60 * 1000, // 2 minutes
    
    // Custom retry configuration
    maxRetries: 5,
    retryDelay: 500, // 500ms
    retryBackoffMultiplier: 1.5,
  };

  return new DashboardService(customConfig);
}

// Example 3: Refreshing data (bypassing cache)
export async function refreshDashboardData() {
  try {
    // Refresh specific data
    const freshSystemStatus = await dashboardService.refreshSystemStatus();
    console.log('Fresh system status:', freshSystemStatus);

    // Refresh all data
    const allFreshData = await dashboardService.refreshAllDashboardData();
    console.log('All fresh data:', allFreshData);

  } catch (error) {
    console.error('Refresh error:', error);
  }
}

// Example 4: Cache management
export function manageDashboardCache() {
  // Get cache statistics
  const stats = dashboardService.getCacheStats();
  console.log('Cache stats:', stats);

  // Clean up expired entries
  const cleanedCount = dashboardService.cleanupExpiredCache();
  console.log(`Cleaned ${cleanedCount} expired cache entries`);

  // Clear all cache
  dashboardService.clearAllCache();
  console.log('All cache cleared');
}

// Example 5: Error handling strategies
export async function handleDashboardErrors() {
  try {
    // Strategy 1: Fail fast - throw on first error
    const dataFailFast = await dashboardService.getAllDashboardData({}, { failFast: true });
    console.log('All data loaded successfully:', dataFailFast);
    
  } catch (error) {
    console.error('Failed fast:', error);
    
    // Strategy 2: Graceful degradation - collect all errors
    const dataGraceful = await dashboardService.getAllDashboardData();
    
    // Check what data we got
    if (dataGraceful.systemStatus) {
      console.log('System status available');
    }
    
    if (dataGraceful.jobMetrics) {
      console.log('Job metrics available');
    }
    
    // Handle specific errors
    if (dataGraceful.errors['systemStatus']) {
      console.warn('System status failed, using fallback');
      // Implement fallback logic
    }
    
    if (dataGraceful.errors['jobMetrics']) {
      console.warn('Job metrics failed, showing cached data');
      // Show cached or default data
    }
  }
}

// Example 6: Real-time dashboard updates
export class DashboardManager {
  private refreshInterval: NodeJS.Timeout | null = null;
  private customService: DashboardService;

  constructor() {
    // Use custom service with shorter TTL for real-time updates
    this.customService = new DashboardService({
      systemStatusTTL: 5 * 1000, // 5 seconds
      jobMetricsTTL: 10 * 1000, // 10 seconds
      recentActivityTTL: 3 * 1000, // 3 seconds
      jobTrendsTTL: 30 * 1000, // 30 seconds
      maxRetries: 2,
      retryDelay: 1000,
      retryBackoffMultiplier: 2,
    });
  }

  startRealTimeUpdates(callback: (data: any) => void, intervalMs: number = 10000) {
    this.refreshInterval = setInterval(async () => {
      try {
        const data = await this.customService.getAllDashboardData();
        callback(data);
      } catch (error) {
        console.error('Real-time update failed:', error);
      }
    }, intervalMs);
  }

  stopRealTimeUpdates() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  async forceRefresh() {
    return await this.customService.refreshAllDashboardData();
  }
}

// Example usage of DashboardManager
export function setupRealTimeDashboard() {
  const manager = new DashboardManager();
  
  // Start real-time updates every 10 seconds
  manager.startRealTimeUpdates((data) => {
    console.log('Dashboard updated:', data);
    // Update UI components here
  }, 10000);

  // Force refresh on user action
  const handleRefreshClick = async () => {
    try {
      const freshData = await manager.forceRefresh();
      console.log('Force refreshed:', freshData);
    } catch (error) {
      console.error('Force refresh failed:', error);
    }
  };

  // Cleanup on component unmount
  const cleanup = () => {
    manager.stopRealTimeUpdates();
  };

  return { handleRefreshClick, cleanup };
}