import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';
import type { PaginatedTasksResponse, EnhancedTask, TaskListQuery, ApiResponse } from '$lib/types';
import { parseUrlParams } from '$lib/utils';

export const load: PageLoad = async ({ fetch, url }) => {
	// Define parameter schema with validation
	const paramSchema = {
		page: {
			default: 1,
			parse: (value: string) => Math.max(1, parseInt(value) || 1),
			validate: (value: number) => value >= 1
		},
		limit: {
			default: 25,
			parse: (value: string) => parseInt(value) || 25,
			validate: (value: number) => [10, 25, 50, 100].includes(value)
		},
		sort: {
			default: 'name' as const,
			validate: (value: string) => ['name', 'lastExecution', 'successRate'].includes(value)
		},
		order: {
			default: 'asc' as const,
			validate: (value: string) => ['asc', 'desc'].includes(value)
		},
		search: {
			default: '',
			validate: (value: string) => typeof value === 'string'
		}
	};

	// Parse and validate URL parameters
	const queryParams = parseUrlParams(url.searchParams, paramSchema);

	// Build query string for API call
	const apiQueryParams = new URLSearchParams();
	apiQueryParams.set('page', queryParams.page.toString());
	apiQueryParams.set('limit', queryParams.limit.toString());
	apiQueryParams.set('sort', queryParams.sort);
	apiQueryParams.set('order', queryParams.order);
	
	// Only add search if it's not empty
	if (queryParams.search.trim()) {
		apiQueryParams.set('search', queryParams.search.trim());
	}

	try {
		const response = await callApi(`/api/tasks?${apiQueryParams.toString()}`, undefined, fetch);
		
		if (!response?.ok) {
			throw new Error(`Failed to fetch tasks: ${response?.status} ${response?.statusText}`);
		}

		const apiResponse: ApiResponse<PaginatedTasksResponse> = await response.json();
		
		// Handle the ApiResponse wrapper structure
		if (!apiResponse.success || !apiResponse.data) {
			throw new Error(apiResponse.error?.message || 'API request failed');
		}
		
		const { data: tasks, pagination } = apiResponse.data;
		
		// Validate pagination structure
		const validatedPagination = {
			page: pagination?.page || queryParams.page,
			limit: pagination?.limit || queryParams.limit,
			total: pagination?.total || 0,
			total_pages: pagination?.total_pages || 0,
			has_next: pagination?.has_next || false,
			has_prev: pagination?.has_prev || false
		};
		
		return {
			tasks: tasks || [],
			pagination: validatedPagination,
			queryParams,
			loading: false,
			error: null
		};
	} catch (error) {
		console.error('Error loading tasks:', error);
		
		// Return error state with fallback data
		return {
			tasks: [],
			pagination: {
				page: queryParams.page,
				limit: queryParams.limit,
				total: 0,
				total_pages: 0,
				has_next: false,
				has_prev: false
			},
			queryParams,
			loading: false,
			error: error instanceof Error ? error.message : 'Failed to load tasks'
		};
	}
};