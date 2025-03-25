import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/tasks');
	const tasks = await response.json();
	return { tasks: tasks.data };
};