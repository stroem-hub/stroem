import { accessToken, authUser } from '$lib/stores';
import { get } from 'svelte/store';

export async function refreshAccessToken(fetchFunc: any = null,) {
	const fetchCall = fetchFunc || fetch;
	const response = await fetchCall('/api/auth/refresh', {
		method: 'POST',
		credentials: 'include' // Send HTTP-only cookie
	});

	if (response.ok) {
		const data = await response.json();
		accessToken.set(data.data.access_token);
		authUser.set(data.data.user); // Update user info if provided
		return true;
	} else {
		return false;
	}
}

export async function callApi(
	input: RequestInfo,
	init: RequestInit = {},
	fetchFunc: any = null,
): Promise<Response | null> {
	const token = get(accessToken);

	const authInit: RequestInit = {
		...init,
		headers: {
			...(init.headers || {}),
			Authorization: token ? `Bearer ${token}` : '',
			'Content-Type': 'application/json',
		},
		credentials: 'include',
	};

	const fetchCall = fetchFunc || fetch;
	let response = null;
	if (token) {
		response = await fetchCall(input, authInit);
	}

	if (!token || response?.status === 401) {
		const refreshed = await refreshAccessToken(fetchFunc);

		if (!refreshed) return null;

		const newToken= get(accessToken);
		const retryInit: RequestInit = {
			...init,
			headers: {
				...(init.headers || {}),
				Authorization: newToken ? `Bearer ${newToken}` : '',
				'Content-Type': 'application/json',
			},
			credentials: 'include',
		};

		response = await fetchCall(input, retryInit);
		if (response.status === 401) return null;
	}

	return response;
}