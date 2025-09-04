import type {
	SystemStatus,
	JobExecutionMetrics,
	RecentActivity,
	JobTrendsData,
	ApiResponse
} from '$lib/types';
import { callApi } from '$lib/auth';

const API_BASE = '/api';

/**
 * Retry configuration for API requests
 */
interface RetryConfig {
	maxRetries: number;
	baseDelay: number;
	maxDelay: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxRetries: 3,
	baseDelay: 1000,
	maxDelay: 10000
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay
 */
function calculateDelay(attempt: number, config: RetryConfig): number {
	const delay = config.baseDelay * Math.pow(2, attempt);
	return Math.min(delay, config.maxDelay);
}

/**
 * Generic API request function with retry logic using callApi from auth
 */
async function apiRequest<T>(
	url: string,
	options: RequestInit = {},
	retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<ApiResponse<T>> {
	let lastError: Error = new Error('Unknown error');

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
		try {
			const response = await callApi(url, options);

			if (!response) {
				throw new Error('Authentication failed - no response received');
			}

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			return {
				data,
				success: true
			};
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Don't retry on the last attempt
			if (attempt < retryConfig.maxRetries) {
				const delay = calculateDelay(attempt, retryConfig);
				await sleep(delay);
			}
		}
	}

	return {
		success: false,
		error: {
			message: lastError.message,
			code: 'NETWORK_ERROR'
		}
	};
}

/**
 * Fetch system status information
 */
export async function fetchSystemStatus(): Promise<ApiResponse<SystemStatus>> {
	return apiRequest<SystemStatus>(`${API_BASE}/dashboard/system-status`);
}

/**
 * Fetch job execution metrics
 */
export async function fetchJobMetrics(): Promise<ApiResponse<JobExecutionMetrics>> {
	return apiRequest<JobExecutionMetrics>(`${API_BASE}/dashboard/job-metrics`);
}

/**
 * Fetch recent activity data
 */
export async function fetchRecentActivity(): Promise<ApiResponse<RecentActivity>> {
	return apiRequest<RecentActivity>(`${API_BASE}/dashboard/recent-activity`);
}

/**
 * Fetch job execution trends data
 * @param range Time range for the trends data
 */
export async function fetchJobTrends(
	range: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<ApiResponse<JobTrendsData>> {
	const url = `${API_BASE}/dashboard/job-trends?range=${range}`;
	return apiRequest<JobTrendsData>(url);
}