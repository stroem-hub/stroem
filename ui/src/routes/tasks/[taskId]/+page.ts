import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';
import type { ApiResponse, Task, PaginatedTaskJobsResponse, JobListQuery } from '$lib/types';
import { parseUrlParams } from '$lib/utils';

export const load: PageLoad = async ({ fetch, params, url }) => {
	// Define parameter schema for job pagination
	const jobParamSchema = {
		page: {
			default: 1,
			parse: (value: string) => Math.max(1, parseInt(value) || 1),
			validate: (value: number) => value >= 1
		},
		limit: {
			default: 20,
			parse: (value: string) => parseInt(value) || 20,
			validate: (value: number) => [10, 20, 50, 100].includes(value)
		},
		status: {
			default: undefined as string | undefined,
			validate: (value: string | undefined) => 
				!value || ['success', 'failed', 'running', 'queued'].includes(value)
		},
		sort: {
			default: 'start_datetime' as const,
			validate: (value: string) => ['start_datetime', 'end_datetime', 'duration', 'status'].includes(value)
		},
		order: {
			default: 'desc' as const,
			validate: (value: string) => ['asc', 'desc'].includes(value)
		}
	};

	// Parse and validate URL parameters for job pagination
	const jobsParams = parseUrlParams(url.searchParams, jobParamSchema);

	try {
		// Fetch task details
		const taskResponse = await callApi(`/api/tasks/${params.taskId}`, undefined, fetch);
		
		if (!taskResponse?.ok) {
			throw new Error(`Failed to fetch task: ${taskResponse?.status} ${taskResponse?.statusText}`);
		}

		const taskApiResponse: ApiResponse<Task> = await taskResponse.json();
		
		if (!taskApiResponse.success || !taskApiResponse.data) {
			throw new Error(taskApiResponse.error?.message || 'Failed to load task');
		}

		// Build query parameters for jobs API
		const jobsApiParams = new URLSearchParams();
		jobsApiParams.set('page', jobsParams.page.toString());
		jobsApiParams.set('limit', jobsParams.limit.toString());
		jobsApiParams.set('sort', jobsParams.sort);
		jobsApiParams.set('order', jobsParams.order);
		
		// Only add status filter if it's specified
		if (jobsParams.status) {
			jobsApiParams.set('status', jobsParams.status);
		}

		// Fetch paginated job history
		const jobsPromise = callApi(
			`/api/tasks/${params.taskId}/jobs?${jobsApiParams.toString()}`, 
			undefined, 
			fetch
		).then(async (response) => {
			if (!response?.ok) {
				throw new Error(`Failed to fetch jobs: ${response?.status} ${response?.statusText}`);
			}

			const jobsApiResponse = await response.json();
			
			if (!jobsApiResponse.success) {
				throw new Error(jobsApiResponse.error?.message || 'Failed to load job history');
			}

			return jobsApiResponse;
		}).catch((error) => {
			console.error('Error loading job history:', error);
			// Return error response structure
			return {
				success: false,
				error: {
					message: error instanceof Error ? error.message : 'Failed to load job history'
				}
			};
		});

		return {
			task: taskApiResponse,
			jobs: jobsPromise,
			jobsParams,
			loading: false,
			error: null
		};
	} catch (error) {
		console.error('Error loading task:', error);
		
		// Return error state
		return {
			task: {
				success: false,
				error: {
					message: error instanceof Error ? error.message : 'Failed to load task'
				}
			} as ApiResponse<Task>,
			jobs: Promise.resolve({
				success: false,
				error: {
					message: 'Task loading failed'
				}
			}),
			jobsParams,
			loading: false,
			error: error instanceof Error ? error.message : 'Failed to load task'
		};
	}
};