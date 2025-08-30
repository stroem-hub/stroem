<script lang="ts">
	import { onMount } from 'svelte';
	import { callApi } from '$lib/auth';

	let apiResponse = $state(null);
	let error = $state(null);
	let loading = $state(true);

	onMount(async () => {
		try {
			const response = await callApi('/api/tasks');
			if (response?.ok) {
				apiResponse = await response.json();
			} else {
				error = `HTTP ${response?.status}: ${response?.statusText}`;
			}
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	});
</script>

<h1>Debug Tasks API</h1>

{#if loading}
	<p>Loading...</p>
{:else if error}
	<p style="color: red;">Error: {error}</p>
{:else if apiResponse}
	<pre>{JSON.stringify(apiResponse, null, 2)}</pre>
{:else}
	<p>No response</p>
{/if}