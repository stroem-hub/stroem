/**
 * API response types that match the server contracts
 * These interfaces define the exact structure of responses from the Strøm server
 */

import type { 
  User, 
  Task, 
  Job, 
  LogEntry, 
  SystemStatus, 
  JobExecutionMetrics, 
  RecentActivity, 
  JobTrendsData,
  PaginatedResponse 
} from '../types';

// Authentication API responses
// The server returns providers directly as an array, not wrapped in an object
export type AuthProvidersResponse = AuthProvider[];

export interface AuthProvider {
  id: string;
  name: string;
  type: 'internal' | 'oidc';
  primary: boolean;
}

export interface LoginRequest {
  provider_id: string;
  email?: string;
  password?: string;
  // Additional fields for OIDC providers
  [key: string]: unknown;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  access_token: string;
  user: User;
}

export interface UserInfoResponse {
  success: boolean;
  data: User;
}

// Task API responses
export interface TasksResponse extends PaginatedResponse<Task> {}

export interface TaskResponse {
  task: Task;
}

export interface TaskJobsResponse extends PaginatedResponse<Job> {}

export interface TaskExecutionRequest {
  task_id: string;
  parameters?: Record<string, unknown>;
}

export interface TaskExecutionResponse {
  job_id: string;
  message: string;
}

// Job API responses
export interface JobsResponse {
  jobs: Job[];
}

export interface JobResponse {
  job: Job;
}

export interface JobLogsResponse {
  logs: LogEntry[];
}

export interface JobStepLogsResponse {
  logs: LogEntry[];
  step_name: string;
}

export interface JobExecutionRequest {
  task_name: string;
  parameters?: Record<string, unknown>;
  triggered_by?: string;
}

// Dashboard API responses
export interface DashboardSystemStatusResponse {
  system_status: SystemStatus;
}

export interface DashboardJobMetricsResponse {
  job_metrics: JobExecutionMetrics;
}

export interface DashboardRecentActivityResponse {
  recent_activity: RecentActivity;
}

export interface DashboardJobTrendsResponse {
  job_trends: JobTrendsData;
}

// Query parameters for API requests
export interface TaskListParams {
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: 'name' | 'created_at' | 'last_execution';
  sort_order?: 'asc' | 'desc';
}

export interface JobListParams {
  page?: number;
  limit?: number;
  status?: Job['status'];
  task_name?: string;
  triggered_by?: string;
  start_date?: string;
  end_date?: string;
  sort_by?: 'start_datetime' | 'end_datetime' | 'duration' | 'status';
  sort_order?: 'asc' | 'desc';
}

export interface JobTrendsParams {
  range?: '1h' | '6h' | '24h' | '7d' | '30d';
  granularity?: 'minute' | 'hour' | 'day';
}

// Server-Sent Events types
export interface JobUpdateEvent {
  type: 'job_update';
  job_id: string;
  status: Job['status'];
  timestamp: string;
}

export interface LogUpdateEvent {
  type: 'log_update';
  job_id: string;
  log_entry: LogEntry;
}

export interface SystemUpdateEvent {
  type: 'system_update';
  data: Partial<SystemStatus>;
}

export type SSEEvent = JobUpdateEvent | LogUpdateEvent | SystemUpdateEvent;

// Error response format from server
export interface ServerErrorResponse {
  error: string;
  message: string;
  details?: unknown;
  timestamp: string;
}

// Generic API response wrapper (if server uses this pattern)
export interface ServerResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  timestamp: string;
}

// WebSocket message types (for future use)
export interface WebSocketMessage {
  type: string;
  payload: unknown;
  timestamp: string;
}

export interface JobSubscriptionMessage extends WebSocketMessage {
  type: 'job_subscription';
  payload: {
    job_id: string;
    action: 'subscribe' | 'unsubscribe';
  };
}

export interface LogStreamMessage extends WebSocketMessage {
  type: 'log_stream';
  payload: {
    job_id: string;
    log_entry: LogEntry;
  };
}