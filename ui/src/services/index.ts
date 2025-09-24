// Export all services
export { apiClient, ApiClient } from './apiClient';
export { authService, AuthService } from './authService';
export { dashboardService, DashboardService, type DashboardServiceConfig } from './dashboardService';
export { taskService, TaskService } from './taskService';
export { jobService, JobService } from './jobService';

// Export types
export type { RequestConfig, ApiClientResponse } from './apiClient';
export * from './apiTypes';

// Re-export commonly used types
export type { 
  ApiResponse, 
  ApiError, 
  AppError,
  User,
  AuthResponse,
  Task,
  Job,
  LogEntry,
  SystemStatus,
  JobExecutionMetrics,
  RecentActivity,
  JobTrendsData,
  PaginatedResponse
} from '../types';