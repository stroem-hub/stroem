// Component Types
export interface ComponentProps {
  class?: string;
}

export interface ButtonProps extends ComponentProps {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export interface CardProps extends ComponentProps {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export interface InputProps extends ComponentProps {
  type?: 'text' | 'email' | 'password' | 'number' | 'search' | 'url' | 'tel';
  label?: string;
  placeholder?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
}

export interface SelectOption<T = any> {
  label: string;
  value: T;
  disabled?: boolean;
}

export interface SelectProps<T = any> extends ComponentProps {
  options: SelectOption<T>[];
  value?: T;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  multiple?: boolean;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  href?: string;
  icon?: any;
  children?: NavigationItem[];
  badge?: string | number;
  active?: boolean;
}

export interface SidebarProps extends ComponentProps {
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  items?: NavigationItem[];
  user?: User;
  onLogout?: () => void;
}

export interface Breadcrumb {
  label: string;
  href?: string;
}

export interface PageLayoutProps extends ComponentProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  showBreadcrumbs?: boolean;
  maxWidth?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  contentClass?: string;
  headerClass?: string;
}

// Data Types
export interface User {
  user_id: string;
  name: string | null;
  email: string;
  avatar?: string;
}

export interface Job {
  job_id: string;
  task?: string;
  action?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  success?: boolean;
  start_datetime?: string;
  end_datetime?: string;
  input?: any;
  output?: any;
  steps: JobStep[];
  worker_id?: string;
  source_type?: string;
  source_id?: string;
  revision?: string;
}

export interface JobStep {
  step_id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  start_time?: string;
  end_time?: string;
  logs?: string[];
}

export interface Task {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputField>;
  flow: any;
  tags?: string[];
  last_run?: string;
  success_rate?: number;
}

export interface InputField {
  type: string;
  description?: string;
  required?: boolean;
  default?: any;
}

export interface Action {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputField>;
  output_schema?: any;
  examples?: ActionExample[];
}

export interface ActionExample {
  name: string;
  description?: string;
  input: any;
  output?: any;
}

export interface Trigger {
  id: string;
  name?: string;
  description?: string;
  type: 'cron' | 'webhook' | 'manual';
  schedule?: string;
  enabled: boolean;
  last_triggered?: string;
  next_trigger?: string;
  associated_tasks: string[];
}

// Dashboard Types
export interface DashboardMetrics {
  total_jobs: number;
  running_jobs: number;
  success_rate: number;
  avg_execution_time: number;
  active_workers: number;
  total_tasks: number;
  recent_activity: ActivityItem[];
  job_trends: ChartDataPoint[];
  execution_times: ChartDataPoint[];
}

export interface ActivityItem {
  id: string;
  type: 'job_started' | 'job_completed' | 'job_failed' | 'task_created';
  title: string;
  description?: string;
  timestamp: Date;
  user?: string;
  metadata?: Record<string, any>;
}

export interface ChartDataPoint {
  [key: string]: string | number | Date;
}

export interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory_usage: number;
  cpu_usage: number;
  disk_usage: number;
  database_status: 'connected' | 'disconnected';
  worker_status: WorkerStatus[];
}

export interface WorkerStatus {
  worker_id: string;
  status: 'online' | 'offline' | 'busy';
  last_seen: string;
  current_job?: string;
  total_jobs_completed: number;
}

// Table Types
export interface TableColumn<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T) => any;
  width?: string;
}

export interface PaginationConfig {
  page: number;
  limit: number;
  total: number;
}

// API Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Theme Types
export type Theme = 'light' | 'dark' | 'system';

// Toast Types
export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  duration?: number;
  dismissible?: boolean;
}