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

// Task Management Types
export interface TaskStatistics {
	total_executions: number;
	success_rate: number;
	last_execution?: {
		timestamp: string;
		status: 'success' | 'failed' | 'running' | 'queued';
		triggered_by: string;
		duration?: number;
	};
	average_duration?: number;
}

export interface EnhancedTask {
	id: string;
	name?: string;
	description?: string;
	input?: Record<string, any>;
	flow: Record<string, any>;
	statistics: TaskStatistics;
}

export interface PaginationInfo {
	page: number;
	limit: number;
	total: number;
	total_pages: number;
	has_next: boolean;
	has_prev: boolean;
}

export interface PaginatedResponse<T> {
	data: T[];
	pagination: PaginationInfo;
}