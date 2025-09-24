import type { PageLoad } from './$types';
import { callApi } from '$lib/auth';

export const load: PageLoad = async ({ fetch, params }) => {
	const response = await callApi('/api/jobs/' + params.jobId, undefined, fetch);
	const res = await response?.json();

	return {
		"job": res,
	};
};