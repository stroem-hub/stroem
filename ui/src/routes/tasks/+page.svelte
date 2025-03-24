<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	type Task = {
		id: string;
		name?: string;
		description?: string;
	};

	let tasks: Task[] = [];

	async function fetchTasks() {
		const response = await fetch('/api/tasks');
		tasks = await response.json();
	}

	function viewTask(taskName: string) {
		goto(`/tasks/${taskName}`);
	}

	onMount(fetchTasks);
</script>

<h1>Tasks</h1>
<div>
{#each tasks as task}
<Card class="max-w-none cursor-pointer hover:bg-gray-50 transition-colors" on:click={() => viewTask(task.id)}>
	<h3 class="text-lg font-semibold text-gray-900">{task.name || task.id}</h3>
	<h4 class="text-sm text-gray-600">{task.id}</h4>
</Card>
{:else}
	<p class="text-gray-500">No tasks available.</p>
{/each}

</div>