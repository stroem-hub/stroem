import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/auth/providers');
	const body = await res.json();

	return {
		providers: body.success ? body.data : [],
	};
};