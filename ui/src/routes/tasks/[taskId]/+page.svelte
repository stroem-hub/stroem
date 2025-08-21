<script lang="ts">
	import { Card, Button } from 'flowbite-svelte';
	import { Input, Label, Helper } from 'flowbite-svelte';
	import { Tabs, TabItem } from 'flowbite-svelte';
	import {
		Table,
		TableBody,
		TableBodyCell,
		TableBodyRow,
		TableHead,
		TableHeadCell,
		Tooltip
	} from 'flowbite-svelte';
	import {
		CloseCircleSolid,
		CheckCircleSolid,
		QuestionCircleSolid,
		InfoCircleSolid
	} from 'flowbite-svelte-icons';
	import { Alert } from 'flowbite-svelte';
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

	let runResponse = $state({ success: true, data: null, error: null });

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
			runResponse = { success: false, data: null, meta: null, error: 'Failed to run task' };
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
</script>

{#if !runResponse.success}
	<Alert border color="red">
		<InfoCircleSolid slot="icon" class="w-5 h-5" />
		<span class="font-medium">Could not run the task.</span>
		{runResponse.error}
	</Alert>
{/if}

<div class="p-6">
	{#if !data.task.success}
		<Card class="max-w-none mb-6 bg-red-50 border-red-200">
			<h3 class="text-lg font-semibold text-red-900">Error</h3>
			<p class="text-red-700">{data.task.error}</p>
			<button
				class="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
				onclick={goBack}
			>
				Back to Tasks
			</button>
		</Card>
	{:else if data.task.data}
		<h1>TASK: {task.name || task.id}</h1>

		<Tabs tabStyle="underline">
			<TabItem open>
				<div slot="title" class="flex items-center gap-2">Activity</div>
				{#await data.jobs}
					Loading...
				{:then jobs}
					{#if !jobs.success}
						<Card class="max-w-none mb-6 bg-red-50 border-red-200">
							<h3 class="text-lg font-semibold text-red-900">Error</h3>
							<p class="text-red-700">{jobs.error}</p>
						</Card>
					{:else if jobs.data}
						<Table hoverable={true}>
							<TableHead>
								<TableHeadCell class="p-4!"></TableHeadCell>
								<TableHeadCell>Started</TableHeadCell>
								<TableHeadCell>Output</TableHeadCell>
								<TableHeadCell>Triggered by</TableHeadCell>
							</TableHead>
							<TableBody tableBodyClass="divide-y cursor-pointer">
								{#each jobs.data as job}
									<TableBodyRow
										onclick={() => {
											openJob(job.job_id);
										}}
									>
										<TableBodyCell class="p-4!">
											{#if job.success === null}
												<QuestionCircleSolid
													class="text-yellow-400 dark:text-yellow-400 shrink-0 h-5 w-5"
												/>
											{:else if job.success}
												<CheckCircleSolid
													class="text-green-400 dark:text-green-400 shrink-0 h-5 w-5"
												/>
											{:else}
												<CloseCircleSolid class="text-red-500 dark:text-red-500 shrink-0 h-5 w-5" />
											{/if}
											<Tooltip placement="left">{job.status}</Tooltip>
										</TableBodyCell>
										<TableBodyCell>{job.start_datetime}</TableBodyCell>
										<TableBodyCell>{job.output || '(No output)'}</TableBodyCell>
										<TableBodyCell>{job.source_type}:{job.source_id || 'unknown'}</TableBodyCell>
									</TableBodyRow>
								{/each}
							</TableBody>
						</Table>
					{:else}
						<Card class="max-w-none mb-6">
							<p class="text-gray-600">No jobs yet</p>
						</Card>
					{/if}
				{:catch error}
					<p>error loading comments: {error.message}</p>
				{/await}
			</TabItem>
			<TabItem>
				<div slot="title" class="flex items-center gap-2">Run</div>

				<form onsubmit={runTask} class="space-y-4">
					{#each getSortedInputs(task.input) as field}
						<div>
							<Label for={field.id} class="block mb-2 text-sm font-medium text-gray-700">
								{field.name || field.id} ({field.type}) {field.required ? '*' : ''}
								{field.order !== undefined ? `[Order: ${field.order}]` : ''}
							</Label>
							{#if field.type === 'string'}
								<Input
									id={field.id}
									name={field.id}
									type="text"
									value={field.default}
									required={field.required}
									class="w-full"
								/>
							{:else if field.type === 'number'}{/if}
						</div>
					{/each}
					<Button type="submit" color="blue" class="w-full">Run</Button>
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
