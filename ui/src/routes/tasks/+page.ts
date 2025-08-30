import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';
import type { PaginatedResponse, EnhancedTask } from '$lib/types';
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
	const { page, limit, sort, order, search } = parseUrlParams(url.searchParams, paramSchema);

	// Build query string for API call
	const queryParams = new URLSearchParams({
		page: page.toString(),
		limit: limit.toString(),
		sort,
		order,
		...(search && { search })
	});

	try {
		const response = await callApi(`/api/tasks?${queryParams.toString()}`, undefined, fetch);
		
		if (!response?.ok) {
			throw new Error(`Failed to fetch tasks: ${response?.status}`);
		}

		const apiResponse = await response.json();
		
		// Debug logging
		console.log('API Response:', apiResponse);
		
		// Handle the ApiResponse wrapper structure
		if (!apiResponse.success) {
			throw new Error(apiResponse.error || 'API request failed');
		}
		
		// Now pagination is at the top level alongside data
		const tasks = apiResponse.data || [];
		const pagination = apiResponse.pagination || {
			page: 1,
			limit: 25,
			total: 0,
			total_pages: 0,
			has_next: false,
			has_prev: false
		};
		
		console.log('Tasks:', tasks);
		console.log('Pagination:', pagination);
		
		return {
			tasks,
			pagination,
			queryParams: {
				page,
				limit,
				sort,
				order,
				search
			}
		};
	} catch (error) {
		console.error('Error loading tasks:', error);
		
		// Return empty state on error
		return {
			tasks: [],
			pagination: {
				page: 1,
				limit: 25,
				total: 0,
				total_pages: 0,
				has_next: false,
				has_prev: false
			},
			queryParams: {
				page: 1,
				limit: 25,
				sort: 'name',
				order: 'asc',
				search: ''
			},
			error: error instanceof Error ? error.message : 'Failed to load tasks'
		};
	}
};