// Core API types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

// Actual API response structure from the server
export interface ApiPaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

// User and Authentication types
export interface User {
  user_id: string;
  email: string;
  name: string | null;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginCredentials {
  email?: string;
  password?: string;
  provider_id?: string;
}

// Task types
export interface Task {
  id: string;
  name: string | null;
  description?: string | null;
  input?: Record<string, TaskInputField>;
  flow?: Record<string, TaskStep>;
  statistics: TaskStatistics;
}

export interface TaskInputField {
  id: string;
  required: boolean;
  description: string;
  order: number | null;
  type: string;
  default: string | null;
}

export interface TaskStep {
  id: string;
  name: string | null;
  action: string;
  input: Record<string, any>;
  depends_on: string[] | null;
  continue_on_fail: boolean | null;
  on_error: string | null;
}

export interface TaskStatistics {
  total_executions: number;
  success_count: number;
  failure_count: number;
  average_duration: number;
  last_execution?: {
    timestamp: string;
    status: string;
    triggered_by: string;
    duration: number;
  };
}

// Job types
export interface Job {
  id: string;
  task_name: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  start_datetime: string;
  end_datetime?: string;
  duration?: number;
  triggered_by: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  step_name?: string;
}

// Dashboard types
export interface SystemStatus {
  active_workers: number;
  idle_workers: number;
  total_jobs_today: number;
  system_uptime: string;
  average_execution_time_24h: number;
  alerts: Alert[];
}

export interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

export interface JobExecutionMetrics {
  today: {
    total_jobs: number;
    success_count: number;
    failure_count: number;
    success_rate: number;
  };
  status_distribution: {
    running: number;
    completed: number;
    failed: number;
    queued: number;
  };
  top_failing_workflows: FailingWorkflow[];
  average_execution_time: number;
}

export interface FailingWorkflow {
  name: string;
  failure_count: number;
  failure_rate: number;
}

export interface RecentActivity {
  recent_jobs: Job[];
  recent_alerts: Alert[];
}

export interface JobTrendsData {
  time_series: {
    timestamp: string;
    total_jobs: number;
    successful_jobs: number;
    failed_jobs: number;
  }[];
}

export type TimeRange = '1h' | '6h' | '24h' | '7d' | '30d';

// Chart types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

// API Error types
export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface AppError {
  type: 'network' | 'auth' | 'validation' | 'server';
  message: string;
  recoverable: boolean;
}