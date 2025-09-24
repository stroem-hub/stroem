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

	console.group(`🔍 Dashboard API Request: ${url}`);
	console.log('Request options:', options);
	console.log('Retry config:', retryConfig);

	for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
		try {
			console.log(`Attempt ${attempt + 1}/${retryConfig.maxRetries + 1}`);
			
			const response = await callApi(url, options);

			if (!response) {
				throw new Error('Authentication failed - no response received');
			}

			console.log('Response status:', response.status, response.statusText);
			console.log('Response headers:', Object.fromEntries(response.headers.entries()));

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			
			console.log('✅ Raw API Response Data:');
			console.log('Data type:', typeof data);
			console.log('Data structure:', data);
			console.log('Data keys:', data ? Object.keys(data) : 'No keys (null/undefined)');
			
			// Deep inspection of nested objects
			if (data && typeof data === 'object') {
				console.log('🔍 Deep structure analysis:');
				for (const [key, value] of Object.entries(data)) {
					console.log(`  ${key}:`, {
						type: typeof value,
						value: value,
						isArray: Array.isArray(value),
						keys: value && typeof value === 'object' ? Object.keys(value) : 'N/A'
					});
				}
			}
			
			console.groupEnd();
			
			return {
				data,
				success: true
			};
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));
			console.error(`❌ Attempt ${attempt + 1} failed:`, lastError.message);

			// Don't retry on the last attempt
			if (attempt < retryConfig.maxRetries) {
				const delay = calculateDelay(attempt, retryConfig);
				console.log(`⏳ Retrying in ${delay}ms...`);
				await sleep(delay);
			}
		}
	}

	console.error('❌ All attempts failed. Final error:', lastError.message);
	console.groupEnd();

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
	console.log('🏥 Fetching System Status...');
	const result = await apiRequest<SystemStatus>(`${API_BASE}/dashboard/system-status`);
	
	if (result.success && result.data) {
		console.log('🏥 System Status - Expected vs Actual Structure:');
		console.log('Expected: { active_workers, idle_workers, total_jobs_today, system_uptime, average_execution_time_24h, alerts }');
		console.log('Actual keys:', Object.keys(result.data));
		console.log('Active workers:', result.data.active_workers, typeof result.data.active_workers);
		console.log('Idle workers:', result.data.idle_workers, typeof result.data.idle_workers);
		console.log('Total jobs today:', result.data.total_jobs_today, typeof result.data.total_jobs_today);
		console.log('System uptime:', result.data.system_uptime, typeof result.data.system_uptime);
		console.log('Avg execution time 24h:', result.data.average_execution_time_24h, typeof result.data.average_execution_time_24h);
		console.log('Alerts:', result.data.alerts, Array.isArray(result.data.alerts));
	}
	
	return result;
}

/**
 * Fetch job execution metrics
 */
export async function fetchJobMetrics(): Promise<ApiResponse<JobExecutionMetrics>> {
	console.log('📊 Fetching Job Execution Metrics...');
	const result = await apiRequest<JobExecutionMetrics>(`${API_BASE}/dashboard/job-metrics`);
	
	if (result.success && result.data) {
		console.log('📊 Job Metrics - Expected vs Actual Structure:');
		console.log('Expected: { today: { total_jobs, success_count, failure_count, success_rate }, status_distribution: { running, completed, failed, queued }, top_failing_workflows, average_execution_time }');
		console.log('Actual keys:', Object.keys(result.data));
		
		// Inspect today object
		if (result.data.today) {
			console.log('Today object:', result.data.today);
			console.log('Today keys:', Object.keys(result.data.today));
			console.log('Today.total_jobs:', result.data.today.total_jobs, typeof result.data.today.total_jobs);
			console.log('Today.success_count:', result.data.today.success_count, typeof result.data.today.success_count);
			console.log('Today.failure_count:', result.data.today.failure_count, typeof result.data.today.failure_count);
			console.log('Today.success_rate:', result.data.today.success_rate, typeof result.data.today.success_rate);
		} else {
			console.warn('❌ Missing "today" object in job metrics!');
		}
		
		// Inspect status_distribution object
		if (result.data.status_distribution) {
			console.log('Status distribution:', result.data.status_distribution);
			console.log('Status distribution keys:', Object.keys(result.data.status_distribution));
		} else {
			console.warn('❌ Missing "status_distribution" object in job metrics!');
		}
		
		console.log('Top failing workflows:', result.data.top_failing_workflows, Array.isArray(result.data.top_failing_workflows));
		console.log('Average execution time:', result.data.average_execution_time, typeof result.data.average_execution_time);
	}
	
	return result;
}

/**
 * Fetch recent activity data
 */
export async function fetchRecentActivity(): Promise<ApiResponse<RecentActivity>> {
	console.log('🔄 Fetching Recent Activity...');
	const result = await apiRequest<RecentActivity>(`${API_BASE}/dashboard/recent-activity`);
	
	if (result.success && result.data) {
		console.log('🔄 Recent Activity - Expected vs Actual Structure:');
		console.log('Expected: { recent_jobs: [], alerts: [], upcoming_jobs: [] }');
		console.log('Actual keys:', Object.keys(result.data));
		console.log('Recent jobs:', result.data.recent_jobs, Array.isArray(result.data.recent_jobs), result.data.recent_jobs?.length);
		console.log('Alerts:', result.data.alerts, Array.isArray(result.data.alerts), result.data.alerts?.length);
		console.log('Upcoming jobs:', result.data.upcoming_jobs, Array.isArray(result.data.upcoming_jobs), result.data.upcoming_jobs?.length);
		
		// Inspect first recent job if available
		if (result.data.recent_jobs && result.data.recent_jobs.length > 0) {
			console.log('First recent job structure:', result.data.recent_jobs[0]);
			console.log('First recent job keys:', Object.keys(result.data.recent_jobs[0]));
		}
	}
	
	return result;
}

/**
 * Fetch job execution trends data
 * @param range Time range for the trends data
 */
export async function fetchJobTrends(
	range: '1h' | '24h' | '7d' | '30d' = '24h'
): Promise<ApiResponse<JobTrendsData>> {
	console.log(`📈 Fetching Job Trends for range: ${range}...`);
	const url = `${API_BASE}/dashboard/job-trends?range=${range}`;
	const result = await apiRequest<JobTrendsData>(url);
	
	if (result.success && result.data) {
		console.log('📈 Job Trends - Expected vs Actual Structure:');
		console.log('Expected: { time_series: [], time_range: string }');
		console.log('Actual keys:', Object.keys(result.data));
		console.log('Time series:', result.data.time_series, Array.isArray(result.data.time_series), result.data.time_series?.length);
		console.log('Time range:', result.data.time_range, typeof result.data.time_range);
		
		// Inspect first data point if available
		if (result.data.time_series && result.data.time_series.length > 0) {
			console.log('First time series point:', result.data.time_series[0]);
			console.log('First time series point keys:', Object.keys(result.data.time_series[0]));
		}
	}
	
	return result;
}