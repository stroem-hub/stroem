import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await fetch('/api/jobs/' + params.jobId);
	const res = await response.json();

	return {
		"job": res,
	};
};