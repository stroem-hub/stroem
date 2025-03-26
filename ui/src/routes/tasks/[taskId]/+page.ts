import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/tasks/' + params.taskId);
	const res = await response.json();
	return res;
};