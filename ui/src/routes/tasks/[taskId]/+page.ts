import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/tasks/' + params.taskId);
	const res = await response.json();

	// const jobs_response = await fetch('/api/jobs?taskId=' + params.taskId);

	return {
		"task": res,
		"jobs": fetch('/api/jobs?taskId=' + params.taskId).then(response => response.json()),
	};
};