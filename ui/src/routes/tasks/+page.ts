import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await callApi('/api/tasks',undefined, fetch);
	const tasks = await response?.json();
	return { tasks: tasks.data };
};