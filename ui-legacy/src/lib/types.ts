// Common types used across the application

export interface Breadcrumb {
	label: string;
	href?: string;
}

export interface SelectOption {
	value: string;
	label: string;
	disabled?: boolean;
}

export interface Tab {
	id: string;
	title: string;
	disabled?: boolean;
}

export interface ActivityItem {
	id: string;
	type: 'info' | 'success' | 'warning' | 'error';
	title: string;
	description?: string;
	timestamp: Date;
	user?: string;
}

export interface MetricData {
	label: string;
	value: number | string;
	change?: number;
	trend?: 'up' | 'down' | 'neutral';
}

export interface ChartDataPoint {
	[key: string]: string | number | Date;
}

/**
 * Data point for job execution duration chart
 */
export interface JobExecutionPoint {
	/** Timestamp of the job execution (ISO 8601 format) */
	timestamp: string;
	/** Execution duration in seconds */
	duration: number;
	/** Execution status */
	status: ExecutionStatus;
	/** Unique job identifier */
	jobId: string;
	/** Who or what triggered the execution */
	triggeredBy?: string;
}

/**
 * Chart dataset organized by execution status
 */
export interface ChartDataset {
	/** Successful job executions */
	successful: JobExecutionPoint[];
	/** Failed job executions */
	failed: JobExecutionPoint[];
	/** Currently running job executions */
	running: JobExecutionPoint[];
}

/**
 * Props for TaskDurationChart component
 */
export interface TaskDurationChartProps {
	/** Job execution history data for the chart */
	jobHistory: JobExecutionPoint[];
	/** Chart height in pixels */
	height?: number;
	/** Whether to show the legend */
	showLegend?: boolean;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | Error | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

// Task Management Types

/**
 * Represents the execution status of a task or job
 */
export type ExecutionStatus = 'success' | 'failed' | 'running' | 'queued';

/**
 * Represents the trend direction for task performance metrics
 */
export type PerformanceTrend = 'improving' | 'declining' | 'stable';

/**
 * Input field definition for task parameters
 */
export interface InputField {
	/** Unique identifier for the input field */
	id: string;
	/** The type of the input field */
	type: string;
	/** Default value for the field */
	default?: string | number | boolean | null;
	/** Description of the field */
	description?: string;
	/** Whether the field is required */
	required?: boolean;
	/** Display order for the field */
	order?: number;
	/** Display name for the field */
	name?: string;
	/** Validation rules for the field */
	validation?: Record<string, any>;
	/** Example values for the field */
	examples?: any[];
}

/**
 * Flow step definition in a task workflow
 */
export interface FlowStep {
	/** The action to execute in this step */
	action: string;
	/** Input parameters for the step */
	input?: Record<string, any>;
	/** Dependencies on other steps */
	depends_on?: string[];
	/** Whether to continue execution if this step fails */
	continue_on_fail?: boolean;
	/** Error handling configuration */
	on_error?: string;
	/** Conditional execution rules */
	condition?: string;
}

/**
 * Information about the last execution of a task
 */
export interface LastExecution {
	/** Timestamp of the last execution */
	timestamp: string;
	/** Status of the last execution */
	status: ExecutionStatus;
	/** Who or what triggered the execution (format: source_type:source_id) */
	triggered_by: string;
	/** Duration of the execution in seconds */
	duration?: number;
	/** Job ID of the last execution */
	job_id?: string;
}

/**
 * Statistical information about task executions
 */
export interface TaskStatistics {
	/** Total number of executions */
	total_executions: number;
	/** Success rate as a percentage (0-100) */
	success_rate: number;
	/** Information about the last execution */
	last_execution?: LastExecution;
	/** Average execution duration in seconds */
	average_duration?: number;
	/** Recent performance trend */
	recent_trend?: PerformanceTrend;
}

/**
 * Base task interface with core task information
 */
export interface Task {
	/** Unique identifier for the task */
	id: string;
	/** Display name of the task */
	name?: string;
	/** Description of what the task does */
	description?: string;
	/** Input parameter definitions */
	input?: Record<string, InputField>;
	/** Flow step definitions */
	flow: Record<string, FlowStep>;
}

/**
 * Enhanced task interface that includes execution statistics
 */
export interface EnhancedTask extends Task {
	/** Execution statistics for the task */
	statistics: TaskStatistics;
}

/**
 * Pagination metadata for paginated API responses
 */
export interface PaginationInfo {
	/** Current page number (1-based) */
	page: number;
	/** Number of items per page */
	limit: number;
	/** Total number of items across all pages */
	total: number;
	/** Total number of pages */
	total_pages: number;
	/** Whether there is a next page */
	has_next: boolean;
	/** Whether there is a previous page */
	has_prev: boolean;
}

/**
 * Generic paginated response wrapper
 */
export interface PaginatedResponse<T> {
	/** Array of data items for the current page */
	data: T[];
	/** Pagination metadata */
	pagination: PaginationInfo;
}

/**
 * Query parameters for task list API requests
 */
export interface TaskListQuery {
	/** Page number to retrieve (default: 1) */
	page?: number;
	/** Number of items per page (default: 25, max: 100) */
	limit?: number;
	/** Field to sort by */
	sort?: 'name' | 'lastExecution' | 'successRate';
	/** Sort order */
	order?: 'asc' | 'desc';
	/** Search term for task names/descriptions */
	search?: string;
}

/**
 * Response type for paginated task list API
 */
export type PaginatedTasksResponse = PaginatedResponse<EnhancedTask>;

// Job Management Types

/**
 * Complete job information with all available fields
 */
export interface Job {
	/** Unique identifier for the job */
	job_id: string;
	/** Whether the job completed successfully */
	success?: boolean | null;
	/** When the job started execution */
	start_datetime?: string;
	/** When the job finished execution */
	end_datetime?: string;
	/** Name of the task this job executed */
	task?: string;
	/** Specific action that was executed */
	action?: string;
	/** Input parameters provided to the job */
	input?: any;
	/** Output produced by the job */
	output?: any;
	/** Type of source that triggered the job */
	source_type?: string;
	/** Identifier of the source that triggered the job */
	source_id?: string;
	/** Current status of the job */
	status?: string;
	/** Git revision or version identifier */
	revision?: string;
	/** ID of the worker that executed the job */
	worker_id?: string;
	/** Duration of execution in seconds (calculated field) */
	duration?: number;
}

/**
 * Simplified job summary for task-specific job lists
 */
export interface TaskJobSummary {
	/** Unique identifier for the job */
	job_id: string;
	/** Current status of the job */
	status: string;
	/** When the job started execution */
	start_datetime: string;
	/** When the job finished execution */
	end_datetime?: string;
	/** Duration of execution in seconds */
	duration?: number;
	/** Who or what triggered the job (format: source_type:source_id) */
	triggered_by: string;
	/** Whether the job completed successfully */
	success?: boolean;
}

/**
 * Query parameters for job list API requests
 */
export interface JobListQuery {
	/** Page number to retrieve (default: 1) */
	page?: number;
	/** Number of items per page (default: 20, max: 100) */
	limit?: number;
	/** Filter by job status */
	status?: ExecutionStatus;
	/** Field to sort by */
	sort?: 'start_datetime' | 'end_datetime' | 'duration' | 'status';
	/** Sort order */
	order?: 'asc' | 'desc';
}

/**
 * Response type for paginated job list API
 */
export type PaginatedJobsResponse = PaginatedResponse<Job>;

/**
 * Response type for paginated task-specific job list API
 */
export type PaginatedTaskJobsResponse = PaginatedResponse<TaskJobSummary>;

// Component Prop Types

/**
 * Props for TaskCard component
 */
export interface TaskCardProps {
	/** Enhanced task data to display */
	task?: EnhancedTask;
	/** Optional click handler for navigation */
	onClick?: () => void;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | Error | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for TaskHeader component
 */
export interface TaskHeaderProps {
	/** Enhanced task data to display */
	task?: EnhancedTask;
	/** Optional handler for run task action */
	onRunTask?: () => void;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | Error | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for TaskStatistics component
 */
export interface TaskStatisticsProps {
	/** Task statistics to display */
	statistics?: TaskStatistics;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | Error | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for TaskConfiguration component
 */
export interface TaskConfigurationProps {
	/** Task configuration to display */
	task?: Task;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | Error | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for TaskStatusBadge component
 */
export interface TaskStatusBadgeProps {
	/** Execution status to display */
	status: ExecutionStatus;
	/** Optional additional CSS classes */
	class?: string;
}

/**
 * Props for Pagination component
 */
export interface PaginationProps {
	/** Current page number */
	currentPage: number;
	/** Total number of pages */
	totalPages: number;
	/** Total number of items */
	totalItems: number;
	/** Number of items per page */
	itemsPerPage: number;
	/** Handler for page changes */
	onPageChange: (page: number) => void;
	/** Handler for page size changes */
	onPageSizeChange: (size: number) => void;
	/** Available page size options */
	pageSizeOptions?: number[];
	/** Whether pagination is currently loading */
	loading?: boolean;
}

// API Response Types

/**
 * Standard API error response
 */
export interface ApiError {
	/** Error message */
	message: string;
	/** Error code */
	code?: string;
	/** Additional error details */
	details?: Record<string, any>;
}

/**
 * API response wrapper for error handling
 */
export interface ApiResponse<T> {
	/** Response data (present on success) */
	data?: T;
	/** Pagination information (present for paginated responses) */
	pagination?: PaginationInfo;
	/** Error information (present on failure) */
	error?: ApiError;
	/** Whether the request was successful */
	success: boolean;
}

// URL State Management Types

/**
 * URL parameters for task list page
 */
export interface TaskListUrlParams {
	/** Current page number */
	page?: string;
	/** Items per page */
	limit?: string;
	/** Sort field */
	sort?: string;
	/** Sort order */
	order?: string;
	/** Search query */
	search?: string;
}

/**
 * URL parameters for task detail page job history
 */
export interface TaskJobsUrlParams {
	/** Current page number */
	page?: string;
	/** Items per page */
	limit?: string;
	/** Status filter */
	status?: string;
	/** Sort field */
	sort?: string;
	/** Sort order */
	order?: string;
}

// Dashboard Types

/**
 * System alert information for dashboard monitoring
 */
export interface SystemAlert {
	/** Unique identifier for the alert */
	id: string;
	/** Alert severity level */
	severity: 'info' | 'warning' | 'error';
	/** Alert message text */
	message: string;
	/** When the alert was generated (ISO 8601 format) */
	timestamp: string;
	/** Source system or component that generated the alert */
	source?: string;
}

/**
 * System status information for dashboard overview
 */
export interface SystemStatus {
	/** Number of currently active workers */
	active_workers: number;
	/** Number of idle workers available for tasks */
	idle_workers: number;
	/** Total number of jobs executed today */
	total_jobs_today: number;
	/** System uptime in ISO 8601 duration format (e.g., "P2DT14H30M") */
	system_uptime: string;
	/** Average job execution time over the last 24 hours in seconds */
	average_execution_time_24h: number;
	/** Current system alerts and warnings */
	alerts: SystemAlert[];
}

/**
 * Job execution metrics for performance monitoring
 */
export interface JobExecutionMetrics {
	/** Today's job execution statistics */
	today: {
		/** Total number of jobs executed today */
		total_jobs: number;
		/** Number of successful job executions */
		success_count: number;
		/** Number of failed job executions */
		failure_count: number;
		/** Success rate as a percentage (0-100) */
		success_rate: number;
	};
	/** Current distribution of jobs by status */
	status_distribution: {
		/** Number of currently running jobs */
		running: number;
		/** Number of completed jobs */
		completed: number;
		/** Number of failed jobs */
		failed: number;
		/** Number of queued jobs waiting to execute */
		queued: number;
	};
	/** Workflows with the highest failure rates */
	top_failing_workflows: Array<{
		/** Name of the workflow */
		workflow_name: string;
		/** Failure rate as a percentage (0-100) */
		failure_rate: number;
		/** Total number of executions for this workflow */
		total_executions: number;
	}>;
	/** Average job execution time in seconds */
	average_execution_time: number;
}

/**
 * Recent job execution information for activity monitoring
 */
export interface RecentJob {
	/** Unique identifier for the job */
	job_id: string;
	/** Name of the task that was executed */
	task_name: string;
	/** Current execution status */
	status: ExecutionStatus;
	/** When the job started execution (ISO 8601 format) */
	start_time: string;
	/** Job execution duration in seconds (if completed) */
	duration?: number;
	/** Who or what triggered the job execution */
	triggered_by: string;
}

/**
 * Upcoming scheduled job information
 */
export interface UpcomingJob {
	/** Name of the task to be executed */
	task_name: string;
	/** When the job is scheduled to run (ISO 8601 format) */
	scheduled_time: string;
	/** Type of trigger that will execute the job */
	trigger_type: string;
	/** Estimated duration based on historical data in seconds */
	estimated_duration?: number;
}

/**
 * Recent activity data combining jobs, alerts, and upcoming executions
 */
export interface RecentActivity {
	/** List of recent job executions */
	recent_jobs: RecentJob[];
	/** Current system alerts */
	alerts: SystemAlert[];
	/** Upcoming scheduled job executions */
	upcoming_jobs: UpcomingJob[];
}

/**
 * Time-series data point for job execution trends
 */
export interface JobTrendsDataPoint {
	/** Timestamp for this data point (ISO 8601 format) */
	timestamp: string;
	/** Total number of jobs executed at this time */
	total_jobs: number;
	/** Number of successful job executions */
	successful_jobs: number;
	/** Number of failed job executions */
	failed_jobs: number;
}

/**
 * Job execution trends data for dashboard charts
 */
export interface JobTrendsData {
	/** Array of time-series data points */
	time_series: JobTrendsDataPoint[];
	/** Time range for the data */
	time_range: '1h' | '24h' | '7d' | '30d';
}

// Dashboard Component Props

/**
 * Props for SystemStatusWidget component
 */
export interface SystemStatusWidgetProps {
	/** System status data to display */
	systemStatus?: SystemStatus;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for JobExecutionMetricsWidget component
 */
export interface JobExecutionMetricsWidgetProps {
	/** Job execution metrics to display */
	metrics?: JobExecutionMetrics;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for RecentActivityWidget component
 */
export interface RecentActivityWidgetProps {
	/** Recent activity data to display */
	recentActivity?: RecentActivity;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
}

/**
 * Props for JobExecutionTrendsWidget component
 */
export interface JobExecutionTrendsWidgetProps {
	/** Job trends data to display */
	trendsData?: JobTrendsData;
	/** Whether the component is in loading state */
	loading?: boolean;
	/** Error state for the component */
	error?: string | null;
	/** Retry handler for error recovery */
	onRetry?: () => void;
	/** Handler for time range changes */
	onTimeRangeChange?: (range: '1h' | '24h' | '7d' | '30d') => void;
}

// Loading and Error State Types

/**
 * Loading state for async operations
 */
export interface LoadingState {
	/** Whether the operation is currently loading */
	loading: boolean;
	/** Error message if the operation failed */
	error?: string;
	/** Whether this is a retry attempt */
	retrying?: boolean;
}

/**
 * Paginated loading state that includes pagination info
 */
export interface PaginatedLoadingState extends LoadingState {
	/** Current pagination info */
	pagination?: PaginationInfo;
	/** Whether more pages are being loaded */
	loadingMore?: boolean;
}