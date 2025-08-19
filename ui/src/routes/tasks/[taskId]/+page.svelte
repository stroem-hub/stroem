<script lang="ts">
	import Card from '$lib/components/atoms/Card.svelte';
	import Button from '$lib/components/atoms/Button.svelte';
	import Input from '$lib/components/atoms/Input.svelte';
	import Table from '$lib/components/atoms/Table.svelte';
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

	let task = data.task.data as Task;
	let activeTab = $state('activity');

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

	let runResponse = $state({success: true, data: null, error: null});

	async function runTask(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement}) {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		var inputObj = Object.fromEntries(Array.from(formData.keys()).map(key => [key, formData.getAll(key).length > 1 ? formData.getAll(key) : formData.get(key)]))
		// var formJson = JSON.stringify(formObj)
		// console.log(formJson)

		var payload = {
			"task": task.id,
			"input": inputObj,
		}
		try {
			const res = await fetch('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			runResponse = await res.json();
		} catch (err) {
			runResponse = { success: false, data: null, error: 'Failed to run task' };
			console.error(err);
		}

		if (runResponse.success) {
			goto(`/jobs/${runResponse.data}`)
		}
	}

	function goBack() {
		goto('/tasks');
	}

	function openJob(job_id: string) {
		goto(`/jobs/${job_id}`);
	}

</script>

{#if !runResponse.success}
	<div class="mb-6">
		<div class="bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 text-error-800 dark:text-error-200 px-4 py-3 rounded-lg flex items-center">
			<svg class="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
			</svg>
			<div>
				<span class="font-medium">Could not run the task.</span>
				<p class="text-sm mt-1">{runResponse.error}</p>
			</div>
		</div>
	</div>
{/if}

<div class="space-y-6">
	{#if !data.task.success}
		<Card variant="outlined" class="border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20">
			<div class="p-6">
				<h3 class="text-lg font-semibold text-error-900 dark:text-error-100 mb-2">Error</h3>
				<p class="text-error-700 dark:text-error-300 mb-4">{data.task.error}</p>
				<Button variant="primary" onclick={goBack}>
					Back to Tasks
				</Button>
			</div>
		</Card>
	{:else if data.task.data}
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">
				{task.name || task.id}
			</h1>
			{#if task.description}
				<p class="text-gray-600 dark:text-gray-400 mt-2">{task.description}</p>
			{/if}
		</div>

		{@const tabs = [
			{
				id: 'activity',
				title: 'Activity',
				content: () => {}
			},
			{
				id: 'run',
				title: 'Run Task',
				content: () => {}
			}
		]}

		<div class="w-full">
			<!-- Tab Headers -->
			<div class="border-b border-gray-200 dark:border-gray-700 mb-6">
				<nav class="-mb-px flex space-x-8" aria-label="Tabs">
					<button
						onclick={() => activeTab = 'activity'}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
							{activeTab === 'activity'
								? 'border-primary-500 text-primary-600 dark:text-primary-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
					>
						Activity
					</button>
					<button
						onclick={() => activeTab = 'run'}
						class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
							{activeTab === 'run'
								? 'border-primary-500 text-primary-600 dark:text-primary-400'
								: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
					>
						Run Task
					</button>
				</nav>
			</div>

			<!-- Tab Content -->
			{#if activeTab === 'activity'}
				{#await data.jobs}
					<div class="flex items-center justify-center py-8">
						<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
						<span class="ml-3 text-gray-600 dark:text-gray-400">Loading jobs...</span>
					</div>
				{:then jobs}
					{#if !jobs.success}
						<Card variant="outlined" class="border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20">
							<div class="p-6">
								<h3 class="text-lg font-semibold text-error-900 dark:text-error-100 mb-2">Error</h3>
								<p class="text-error-700 dark:text-error-300">{jobs.error}</p>
							</div>
						</Card>
					{:else if jobs.data && jobs.data.length > 0}
						{@const columns = [
							{ key: 'status', label: 'Status', width: '80px' },
							{ key: 'start_datetime', label: 'Started' },
							{ key: 'output', label: 'Output' },
							{ key: 'source', label: 'Triggered by' }
						]}
						
						{@const tableData = jobs.data.map((job: any) => ({
							...job,
							source: `${job.source_type}:${job.source_id || 'unknown'}`
						}))}

						<Table 
							data={tableData}
							columns={columns}
							onRowClick={(row: any) => openJob(row.job_id)}
						/>
					{:else}
						<Card>
							<div class="p-6 text-center">
								<p class="text-gray-600 dark:text-gray-400">No jobs found for this task yet.</p>
							</div>
						</Card>
					{/if}
				{:catch error}
					<Card variant="outlined" class="border-error-200 dark:border-error-800 bg-error-50 dark:bg-error-900/20">
						<div class="p-6">
							<h3 class="text-lg font-semibold text-error-900 dark:text-error-100 mb-2">Error</h3>
							<p class="text-error-700 dark:text-error-300">Error loading jobs: {error.message}</p>
						</div>
					</Card>
				{/await}
			{:else if activeTab === 'run'}
				<Card>
					<div class="p-6">
						<form onsubmit={runTask} class="space-y-4">
							{#each getSortedInputs(task.input) as field}
								<div>
									<label for={field.id} class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
										{field.name || field.id} ({field.type})
										{#if field.required}
											<span class="text-error-500">*</span>
										{/if}
										{#if field.order !== undefined}
											<span class="text-xs text-gray-500">[Order: {field.order}]</span>
										{/if}
									</label>
									
									{#if field.description}
										<p class="text-sm text-gray-500 dark:text-gray-400 mb-2">{field.description}</p>
									{/if}

									{#if field.type === "string"}
										<Input
											id={field.id}
											name={field.id}
											type="text"
											value={field.default?.toString() || ''}
											required={field.required}
										/>
									{:else if field.type === "number"}
										<Input
											id={field.id}
											name={field.id}
											type="number"
											value={field.default?.toString() || ''}
											required={field.required}
										/>
									{:else}
										<Input
											id={field.id}
											name={field.id}
											type="text"
											value={field.default?.toString() || ''}
											required={field.required}
										/>
										<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">
											Unsupported field type: {field.type}
										</p>
									{/if}
								</div>
							{/each}
							
							<div class="pt-4">
								<Button type="submit" variant="primary" fullWidth>
									Run Task
								</Button>
							</div>
						</form>
					</div>
				</Card>
			{/if}
		</div>
	{:else}
		<Card>
			<div class="p-6 text-center">
				<div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto mb-4"></div>
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">Loading...</h3>
				<p class="text-gray-600 dark:text-gray-400">Fetching task details...</p>
			</div>
		</Card>
	{/if}
</div>