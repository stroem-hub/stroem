<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let error: any | null = null;

	function goBack() {
		goto('/tasks');
	}

</script>

<div class="p-6">
	{#if error}
		<Card class="max-w-none mb-6 bg-red-50 border-red-200">
			<h3 class="text-lg font-semibold text-red-900">Error</h3>
			<p class="text-red-700">{error}</p>
			<button
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
				onclick={goBack}
			>
				Back to Tasks
			</button>
		</Card>
	{:else if data}
		<p>TASK: {data.id}</p>
	{:else}
		<Card class="max-w-none mb-6">
			<h3 class="text-lg font-semibold text-gray-900">Loading...</h3>
			<p class="text-gray-600">Fetching task details...</p>
		</Card>
	{/if}
</div>