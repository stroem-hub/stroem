<script lang="ts">
	import { Card } from 'flowbite-svelte';
	import { Input, Label, Helper } from 'flowbite-svelte';
	import { Tabs, TabItem } from 'flowbite-svelte';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';

	type InputField = {
		type: string;
		default?: string | number | boolean | null;
		required?: boolean;
		description?: string;
		order?: number;
		name?: string;
		id: string;
	};
	/* type FlowStep = {
		action: string;
		input?: Record<string, string>;
		depends_on?: string[];
		continue_on_fail?: boolean;
		on_error?: string
	}; */
	type Task = {
		id: string;
		name?: string;
		description?: string | null;
		input?: Record<string, InputField>;
		flow: any
	};

	let { data }: PageProps = $props();

	let task = data.data as Task;

	function getSortedInputs(input?: Record<string, InputField>): InputField[] {
		if (!input) {
			return [];
		}
		let entries = Object.values(input);
		entries.sort((a, b) => {
			const orderA = a.order ?? Infinity; // Null/undefined → last
			const orderB = b.order ?? Infinity;
			return orderA - orderB;
		});
		return entries;
	}

	async function runTask(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement}) {
		event.preventDefault();
	}

	function goBack() {
		goto('/tasks');
	}

</script>

<div class="p-6">
	{#if !data.success}
		<Card class="max-w-none mb-6 bg-red-50 border-red-200">
			<h3 class="text-lg font-semibold text-red-900">Error</h3>
			<p class="text-red-700">{data.error}</p>
			<button
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
				onclick={goBack}
			>
				Back to Tasks
			</button>
		</Card>
	{:else if data.data}

		<h1>TASK: {task.name || task.id}</h1>

		<Tabs tabStyle="underline">
			<TabItem open>
				<div slot="title" class="flex items-center gap-2">
					Activity
				</div>
				success, timestamp, duration, started_by, output

			</TabItem>
			<TabItem>
			<div slot="title" class="flex items-center gap-2">
				Run
			</div>

		<form onsubmit={runTask} class="space-y-4">
		{#each getSortedInputs(task.input) as field}
			<div>
				<Label for={field.id} class="block mb-2 text-sm font-medium text-gray-700">
					{field.name || field.id } ({field.type}) {field.required ? '*' : ''} {field.order !== undefined ? `[Order: ${field.order}]` : ''}
				</Label>
				{#if field.type === "string"}
					<Input
						id={field.id}
						type="text"
						value={field.default}
						required={field.required}
						class="w-full"
					/>
				{:else if field.type === "number"}
				{/if}
			</div>

		{/each}
		</form>

			</TabItem>
		</Tabs>



	{:else}
		<Card class="max-w-none mb-6">
			<h3 class="text-lg font-semibold text-gray-900">Loading...</h3>
			<p class="text-gray-600">Fetching task details...</p>
		</Card>
	{/if}
</div>