import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await callApi('/api/tasks/' + params.taskId, undefined, fetch);
	const res = await response?.json();

	// const jobs_response = await fetch('/api/jobs?taskId=' + params.taskId);

	return {
		"task": res,
		"jobs": callApi('/api/jobs?taskId=' + params.taskId, undefined, fetch).then(response => response?.json()),
	};
};