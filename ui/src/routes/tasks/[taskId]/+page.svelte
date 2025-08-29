<script lang="ts">
	import { 
		Card, 
		Button, 
		Input, 
		FormField, 
		Tabs, 
		Table, 
		Alert,
		Tooltip
	} from '$lib/components';
	import {
		CloseCircleIcon,
		CheckCircleIcon,
		QuestionCircleIcon,
		InfoCircleIcon
	} from '$lib/components/icons';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import { callApi } from '$lib/auth';

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
		flow: any;
	};

	let { data }: PageProps = $props();

	let task = data.task.data as Task;

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

	let runResponse = $state<{ success: boolean; data: any; error: string | null }>({ success: true, data: null, error: null });

	async function runTask(event: SubmitEvent & { currentTarget: EventTarget & HTMLFormElement }) {
		event.preventDefault();

		const formData = new FormData(event.currentTarget);
		var inputObj = Object.fromEntries(
			Array.from(formData.keys()).map((key) => [
				key,
				formData.getAll(key).length > 1 ? formData.getAll(key) : formData.get(key)
			])
		);
		// var formJson = JSON.stringify(formObj)
		// console.log(formJson)

		var payload = {
			task: task.id,
			input: inputObj
		};
		try {
			const res = await callApi('/api/run', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});

			runResponse = await res?.json();
		} catch (err) {
			runResponse = { success: false, data: null, error: 'Failed to run task' };
			console.error(err);
		}

		if (runResponse.success) {
			goto(`/jobs/${runResponse.data}`);
		}
	}

	function goBack() {
		goto('/tasks');
	}

	function openJob(job_id: string) {
		goto(`/jobs/${job_id}`);
	}

	// Define tabs data with snippets
	const tabsData = [
		{
			id: 'activity',
			title: 'Activity',
			content: activityTabContent
		},
		{
			id: 'run',
			title: 'Run',
			content: runTabContent
		}
	];
</script>

{#snippet activityTabContent()}
	{#await data.jobs}
		Loading...
	{:then jobs}
		{#if !jobs.success}
			<Card class="max-w-none mb-6 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
				{#snippet children()}
					<h3 class="text-lg font-semibold text-red-900 dark:text-red-300">Error</h3>
					<p class="text-red-700 dark:text-red-400">{jobs.error}</p>
				{/snippet}
			</Card>
		{:else if jobs.data}
			<div class="overflow-x-auto">
				<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
					<thead class="bg-gray-50 dark:bg-gray-800">
						<tr>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Started</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Output</th>
							<th class="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Triggered by</th>
						</tr>
					</thead>
					<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
						{#each jobs.data as job}
							<tr class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700" onclick={() => openJob(job.job_id)}>
								<td class="px-4 py-4 whitespace-nowrap">
									<Tooltip text={job.status} placement="right">
										{#snippet children()}
											{#if job.success === null}
												<QuestionCircleIcon class="text-yellow-400 dark:text-yellow-400 shrink-0 h-5 w-5" />
											{:else if job.success}
												<CheckCircleIcon class="text-green-400 dark:text-green-400 shrink-0 h-5 w-5" />
											{:else}
												<CloseCircleIcon class="text-red-500 dark:text-red-500 shrink-0 h-5 w-5" />
											{/if}
										{/snippet}
									</Tooltip>
								</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{job.start_datetime}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{job.output || '(No output)'}</td>
								<td class="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{job.source_type}:{job.source_id || 'unknown'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<Card class="max-w-none mb-6">
				{#snippet children()}
					<p class="text-gray-600 dark:text-gray-400">No jobs yet</p>
				{/snippet}
			</Card>
		{/if}
	{:catch error}
		<p>error loading comments: {error.message}</p>
	{/await}
{/snippet}

{#snippet runTabContent()}
	<form onsubmit={runTask} class="space-y-4">
		{#each getSortedInputs(task.input) as field}
			<FormField 
				label="{field.name || field.id} ({field.type}) {field.required ? '*' : ''} {field.order !== undefined ? `[Order: ${field.order}]` : ''}"
				required={field.required}
			>
				{#snippet children()}
					{#if field.type === 'string'}
						<Input
							id={field.id}
							name={field.id}
							type="text"
							value={field.default?.toString() || ''}
							required={field.required}
							class="w-full"
						/>
					{:else if field.type === 'number'}
						<Input
							id={field.id}
							name={field.id}
							type="number"
							value={field.default?.toString() || ''}
							required={field.required}
							class="w-full"
						/>
					{/if}
				{/snippet}
			</FormField>
		{/each}
		<Button type="submit" variant="primary" class="w-full">Run</Button>
	</form>
{/snippet}

{#if !runResponse.success}
	<Alert variant="error">
		{#snippet icon()}
			<InfoCircleIcon class="w-5 h-5" />
		{/snippet}
		{#snippet children()}
			<span class="font-medium">Could not run the task.</span>
			{runResponse.error}
		{/snippet}
	</Alert>
{/if}

<div class="p-6">
	{#if !data.task.success}
		<Card class="max-w-none mb-6 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
			{#snippet children()}
				<h3 class="text-lg font-semibold text-red-900 dark:text-red-300">Error</h3>
				<p class="text-red-700 dark:text-red-400">{data.task.error}</p>
				<Button
					class="mt-4"
					onclick={goBack}
				>
					Back to Tasks
				</Button>
			{/snippet}
		</Card>
	{:else if data.task.data}
		<h1>TASK: {task.name || task.id}</h1>

		<Tabs tabs={tabsData} />
	{:else}
		<Card class="max-w-none mb-6">
			{#snippet children()}
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Loading...</h3>
				<p class="text-gray-600 dark:text-gray-400">Fetching task details...</p>
			{/snippet}
		</Card>
	{/if}
</div>
