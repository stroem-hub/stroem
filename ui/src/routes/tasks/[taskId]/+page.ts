import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/tasks/' + params.taskId);
	const task = await response.json();
	return task.data;
};