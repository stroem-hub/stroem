<script lang="ts">
	import { callApi } from '$lib/auth';
	import type { PageProps } from './$types';
	import { Card, Badge } from '$lib/components';
	import { onMount } from 'svelte';

	// Define the JobStep type
	interface JobStep {
		success: boolean;
		name: string;
		input?: any;
		output?: any;
		start_datetime: string;
		end_datetime: string;
	}

	// Define the Job type based on your Rust struct
	interface Job {
		worker_id?: string;
		job_id: string;
		success?: boolean;
		start_datetime?: string; // Assuming ISO string from DateTime<Utc>
		end_datetime?: string;   // Assuming ISO string from DateTime<Utc>
		task?: string;
		action?: string;
		input?: any;           // JSON Value, could be object, string, etc.
		output?: any;          // JSON Value
		source_type?: string;
		source_id?: string;
		status?: string;
		revision?: string;
		steps: JobStep[];
	}

	interface LogEntry {
		timestamp: string;
		is_stderr: boolean;
		message: string;
	}

	let { data }: PageProps = $props();

	let job: { success: boolean; data?: Job; error?: string } = $state(data.job);

	// Reactive store for logs (keyed by step name)
	let logs: { [key: string]: LogEntry[] } = $state({});

	// Helper to format dates
	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleString();
	}

	// Helper to stringify JSON values nicely
	function formatJson(value: any): string {
		return JSON.stringify(value, null, 2);
	}

	// Fetch logs for a specific step
	async function fetchLogs(jobId: string, stepName: string | undefined) {
		// Use 'job' as the key for job-level logs, otherwise use stepName
		const key = stepName ?? '-';
		if (logs[key]) return; // Skip if already fetched

		try {
			// Determine the URL based on whether stepName is provided
			const url = stepName
				? `/api/jobs/${jobId}/steps/${stepName}/logs`
				: `/api/jobs/${jobId}/logs`;
			const response = await callApi(url);
			const result = await response?.json();
			if (result.success) {
				logs[key] = result.data;
			}
		} catch (error) {
			console.error(`Failed to fetch logs for ${key}:`, error);
			logs[key] = []; // Empty array on error
		}
	}

	let eventSource: EventSource | null = null;
	function connectSse(jobId : string) {
		eventSource = new EventSource(`/api/jobs/${jobId}/sse`, undefined);
		eventSource.onopen = () => console.log(`Connected to SSE for job ${jobId}`);

		eventSource.addEventListener('step_logs', (event) => {
			const update = JSON.parse(event.data);
			if (update.logs) logs[update.step_name] = [...(logs[update.step_name] || []), ...update.logs];
		});
		eventSource.addEventListener('logs', (event) => {
			const update = JSON.parse(event.data);
			if (update.logs) logs["-"] = [...(logs["-"] || []), ...update.logs];
		});
		eventSource.addEventListener('result', (event) => {
			const update = JSON.parse(event.data);
			if (job.data) {
				job.data.success = update.result.success;
				job.data.end_datetime = update.result.end_datetime;
				job.data.output = update.result.output;
			}
		});
		eventSource.addEventListener('step_result', (event) => {
			const update = JSON.parse(event.data);
			if (job.data) {
				for (const step of job.data.steps) {
					if (step.name == update.step_name) {
						step.output = update.result.output;
						step.success = update.result.success;
						break;
					}
				}
			}

		});
		eventSource.addEventListener('step_start', (event) => {
			const update = JSON.parse(event.data);
			let step = {
				"name": update.step_name,
				"input": update.input,
				"success": false,
				"start_datetime": new Date().toISOString(),
				"end_datetime": new Date().toISOString()
			}
			job.data?.steps.push(step);
		});
		eventSource.addEventListener('start', (event) => {
			const update = JSON.parse(event.data);
			// Update step state
		});
	}

	onMount(async () => {
		if (job.data) {
			// Fetch job-level logs
			await fetchLogs(job.data.job_id, undefined);
			// Fetch logs for each step
			for (const step of job.data.steps) {
				await fetchLogs(job.data.job_id, step.name);
			}

			if (job.data.success == null) { // job is still running
				connectSse(job.data.job_id);
			}

		}
	});
</script>

<div class="p-6">
	{#if !job.success}
		<Card class="max-w-none mb-6 bg-red-50 border-red-200">
			{#snippet children()}
				<h3 class="text-lg font-semibold text-red-900">Error</h3>
				<p class="text-red-700">{job.error}</p>
			{/snippet}
		</Card>
	{:else if job.data}
		<div class="space-y-6">
			<!-- Job Header -->
			<h1 class="text-2xl font-bold text-gray-900">Job: {job.data.job_id}</h1>

			<!-- Job Status Badge -->
			<div>
				<Badge variant={job.data?.success == null ? 'warning' : job.data?.success ? 'success' : 'error'} size="lg">
					{#snippet children()}
						{job.data?.status}
					{/snippet}
				</Badge>
			</div>

			<!-- Job Details Card -->
			<Card class="max-w-none">
				{#snippet children()}
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
					<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">Worker ID</dt>
							<dd class="mt-1 text-gray-900">{job.data?.worker_id || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Status</dt>
							<dd class="mt-1 text-gray-900">{job.data?.status || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Task</dt>
							<dd class="mt-1 text-gray-900">{job.data?.task || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Action</dt>
							<dd class="mt-1 text-gray-900">{job.data?.action || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Start Time</dt>
							<dd class="mt-1 text-gray-900">{job.data?.start_datetime ? formatDate(job.data.start_datetime) : 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">End Time</dt>
							<dd class="mt-1 text-gray-900">{job.data?.end_datetime ? formatDate(job.data.end_datetime) : 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Source Type</dt>
							<dd class="mt-1 text-gray-900">{job.data?.source_type || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Source ID</dt>
							<dd class="mt-1 text-gray-900">{job.data?.source_id || 'N/A'}</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Revision</dt>
							<dd class="mt-1 text-gray-900">{job.data?.revision || 'N/A'}</dd>
						</div>
					</dl>
				{/snippet}
			</Card>

			<!-- Input/Output Card -->
			<Card class="max-w-none">
				{#snippet children()}
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Input & Output</h3>
					<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
						<div>
							<dt class="text-sm font-medium text-gray-500">Input</dt>
							<dd class="mt-1 text-gray-900">
								{#if job.data?.input}
									<pre class="bg-gray-100 p-2 rounded">{formatJson(job.data.input)}</pre>
								{:else}
									N/A
								{/if}
							</dd>
						</div>
						<div>
							<dt class="text-sm font-medium text-gray-500">Output</dt>
							<dd class="mt-1 text-gray-900">
								{#if job.data?.output}
									<pre class="bg-gray-100 p-2 rounded">{formatJson(job.data.output)}</pre>
								{:else}
									N/A
								{/if}
							</dd>
						</div>
					</div>
				{/snippet}
			</Card>

			<!-- Steps Accordion -->
			<Card class="max-w-none">
				{#snippet children()}
					<h3 class="text-lg font-semibold text-gray-900 mb-4">Steps</h3>
					{#if job.data?.steps && job.data.steps.length > 0}
						<!-- Steps accordion -->
						<div class="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
							{#each job.data.steps as step, index}
								<details class="group">
									<summary class="w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
										<div class="flex items-center space-x-2">
											<Badge variant={step.success ? 'success' : 'error'}>
												{#snippet children()}
													{step.success ? 'Success' : 'Failed'}
												{/snippet}
											</Badge>
											<span>{step.name}</span>
										</div>
										<svg class="w-5 h-5 text-gray-500 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</summary>
									<div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
										<div class="pt-4 space-y-4">
											<!-- Input/Output Section -->
											<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
												<div>
													<dt class="text-sm font-medium text-gray-500">Input</dt>
													<dd class="mt-1 text-gray-900">
														{#if step.input}
															<pre class="bg-gray-100 p-2 rounded">{formatJson(step.input)}</pre>
														{:else}
															N/A
														{/if}
													</dd>
												</div>
												<div>
													<dt class="text-sm font-medium text-gray-500">Output</dt>
													<dd class="mt-1 text-gray-900">
														{#if step.output}
															<pre class="bg-gray-100 p-2 rounded">{formatJson(step.output)}</pre>
														{:else}
															N/A
														{/if}
													</dd>
												</div>
											</div>

											<!-- Log Section -->
											<div>
												<dt class="text-sm font-medium text-gray-500">Log</dt>
												<dd class="mt-1 text-gray-900">
													{#if logs[step.name] === undefined}
														<p class="text-gray-600 italic">Loading logs...</p>
													{:else if logs[step.name].length > 0}
														<ul class="space-y-2">
															{#each logs[step.name] as log}
																<li class="flex items-start space-x-2">
																	<span class="text-xs text-gray-500">{formatDate(log.timestamp)}</span>
																	<span class:text-red-600={log.is_stderr} class="font-mono">{log.message}</span>
																</li>
															{/each}
														</ul>
													{:else}
														<p class="text-gray-600 italic">No logs available</p>
													{/if}
												</dd>
											</div>
										</div>
									</div>
								</details>
							{/each}
						</div>
					{:else}
						<p class="text-gray-600">No steps available for this job.</p>
					{/if}
				{/snippet}
			</Card>

			<!-- Runner logs -->
			<div class="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg">
				<details class="group">
					<summary class="w-full px-4 py-3 text-left flex items-center justify-between cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
						<span>Runner logs</span>
						<svg class="w-5 h-5 text-gray-500 transition-transform duration-200 group-open:rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
						</svg>
					</summary>
					<div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
						<div class="pt-4">
							<dt class="text-sm font-medium text-gray-500">Log</dt>
							<dd class="mt-1 text-gray-900">
								{#if logs["-"] === undefined}
									<p class="text-gray-600 italic">Loading logs...</p>
								{:else if logs["-"].length > 0}
									<ul class="space-y-2">
										{#each logs["-"] as log}
											<li class="flex items-start space-x-2">
												<span class="text-xs text-gray-500">{formatDate(log.timestamp)}</span>
												<span class:text-red-600={log.is_stderr} class="font-mono">{log.message}</span>
											</li>
										{/each}
									</ul>
								{:else}
									<p class="text-gray-600 italic">No logs available</p>
								{/if}
							</dd>
						</div>
					</div>
				</details>
			</div>

		</div>



	{:else}
		<Card class="max-w-none mb-6">
			{#snippet children()}
				<h3 class="text-lg font-semibold text-gray-900">Loading...</h3>
				<p class="text-gray-600">Fetching job details...</p>
			{/snippet}
		</Card>
	{/if}
</div>

<style>
    pre {
        white-space: pre-wrap;
        word-wrap: break-word;
    }
</style>