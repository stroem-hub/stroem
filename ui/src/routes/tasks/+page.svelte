<script lang="ts">
	import type { PageProps } from './$types';
	import { Card } from 'flowbite-svelte';
	import { goto } from '$app/navigation';


	function viewTask(taskId: string) {
		goto(`/tasks/${taskId}`);
	}

	let { data }: PageProps = $props();
</script>

<h1>Tasks</h1>
<div>
{#each data.tasks as task}
<Card class="max-w-none cursor-pointer hover:bg-gray-50 transition-colors" onclick={() => viewTask(task.id)}>
	<h3 class="text-lg font-semibold text-gray-900">{task.name || task.id}</h3>
	<h4 class="text-sm text-gray-600">{task.description}</h4>
</Card>
{:else}
	<p class="text-gray-500">No tasks available.</p>
{/each}

</div>