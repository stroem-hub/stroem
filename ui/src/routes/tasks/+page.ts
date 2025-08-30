import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';
import type { PaginatedResponse, EnhancedTask } from '$lib/types';

export const load: PageLoad = async ({ fetch, url }) => {
	// Extract query parameters from URL
	const page = parseInt(url.searchParams.get('page') || '1');
	const limit = parseInt(url.searchParams.get('limit') || '25');
	const sort = url.searchParams.get('sort') || 'name';
	const order = url.searchParams.get('order') || 'asc';
	const search = url.searchParams.get('search') || '';

	// Build query string
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