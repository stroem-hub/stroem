<script lang="ts">
	import type { PageProps } from './$types';
	import Card from '$lib/components/atoms/Card.svelte';
	import Badge from '$lib/components/atoms/Badge.svelte';
	import Accordion from '$lib/components/atoms/Accordion.svelte';
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
	
	// State for managing open/closed steps
	let openSteps = $state<Set<string>>(new Set());

	// Helper to format dates
	function formatDate(isoString: string): string {
		return new Date(isoString).toLocaleString();
	}

	// Helper to stringify JSON values nicely
	function formatJson(value: any): string {
		return JSON.stringify(value, null, 2);
	}

	// Toggle step open/closed state
	function toggleStep(stepName: string) {
		if (openSteps.has(stepName)) {
			openSteps.delete(stepName);
		} else {
			openSteps.add(stepName);
		}
		openSteps = new Set(openSteps); // Trigger reactivity
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
			const response = await fetch(url);
			const result = await response.json();
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
		eventSource = new EventSource(`/api/jobs/${jobId}/sse`);
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
						step.end_datetime = update.result.end_datetime || new Date().toISOString();
						break;
					}
				}
			}
		});
		eventSource.addEventListener('step_start', (event) => {
			const update = JSON.parse(event.data);
			let step: JobStep = {
				name: update.step_name,
				input: update.input,
				success: false,
				start_datetime: new Date().toISOString(),
				end_datetime: ''
			}
			if (job.data) {
				job.data.steps.push(step);
			}
		});
		eventSource.addEventListener('start', (event) => {
			// Job started event - could update job status here if needed
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
			<h3 class="text-lg font-semibold text-red-900">Error</h3>
			<p class="text-red-700">{job.error}</p>
		</Card>
	{:else if job.data}
		<div class="space-y-6">
			<!-- Job Header -->
			<h1 class="text-2xl font-bold text-gray-900">Job: {job.data.job_id}</h1>

			<!-- Job Status Badge -->
			<div>
				<Badge variant={job.data.success == null ? 'warning' : job.data.success ? 'success' : 'error'} size="lg">
					{job.data.status}
				</Badge>
			</div>

			<!-- Job Details Card -->
			<Card class="max-w-none">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Worker ID</dt>
						<dd class="mt-1 text-gray-900">{job.data.worker_id || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Status</dt>
						<dd class="mt-1 text-gray-900">{job.data.status || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Task</dt>
						<dd class="mt-1 text-gray-900">{job.data.task || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Action</dt>
						<dd class="mt-1 text-gray-900">{job.data.action || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Start Time</dt>
						<dd class="mt-1 text-gray-900">{job.data.start_datetime ? formatDate(job.data.start_datetime) : 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">End Time</dt>
						<dd class="mt-1 text-gray-900">{job.data.end_datetime ? formatDate(job.data.end_datetime) : 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Source Type</dt>
						<dd class="mt-1 text-gray-900">{job.data.source_type || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Source ID</dt>
						<dd class="mt-1 text-gray-900">{job.data.source_id || 'N/A'}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Revision</dt>
						<dd class="mt-1 text-gray-900">{job.data.revision || 'N/A'}</dd>
					</div>
				</dl>
			</Card>

			<!-- Input/Output Card -->
			<Card class="max-w-none">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Input & Output</h3>
				<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Input</dt>
						<dd class="mt-1 text-gray-900">
							{#if job.data.input}
								<pre class="bg-gray-100 p-2 rounded">{formatJson(job.data.input)}</pre>
							{:else}
								N/A
							{/if}
						</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">Output</dt>
						<dd class="mt-1 text-gray-900">
							{#if job.data.output}
								<pre class="bg-gray-100 p-2 rounded">{formatJson(job.data.output)}</pre>
							{:else}
								N/A
							{/if}
						</dd>
					</div>
				</div>
			</Card>

			<!-- Steps -->
			<Card>
				<div class="p-6">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Steps</h3>
					{#if job.data.steps.length > 0}
						<div class="space-y-4">
							{#each job.data.steps as step, i}
								{@const isOpen = openSteps.has(step.name)}
								<div class="border border-gray-200 dark:border-gray-700 rounded-lg">
									<button
										class="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200 rounded-t-lg"
										onclick={() => toggleStep(step.name)}
									>
										<div class="flex items-center space-x-3">
											<Badge variant={step.success ? 'success' : 'error'}>
												{step.success ? 'Success' : 'Failed'}
											</Badge>
											<span class="font-medium text-gray-900 dark:text-gray-100">{step.name}</span>
										</div>
										<svg 
											class="w-5 h-5 text-gray-500 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}"
											fill="none" 
											stroke="currentColor" 
											viewBox="0 0 24 24"
										>
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
										</svg>
									</button>
									
									{#if isOpen}
										<div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
											<div class="pt-4 space-y-4">
												<!-- Input/Output Section -->
												<div class="grid grid-cols-1 gap-6 sm:grid-cols-2">
													<div>
														<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Input</dt>
														<dd class="mt-1 text-gray-900 dark:text-gray-100">
															{#if step.input}
																<pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-auto">{formatJson(step.input)}</pre>
															{:else}
																N/A
															{/if}
														</dd>
													</div>
													<div>
														<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Output</dt>
														<dd class="mt-1 text-gray-900 dark:text-gray-100">
															{#if step.output}
																<pre class="bg-gray-100 dark:bg-gray-800 p-2 rounded text-sm overflow-auto">{formatJson(step.output)}</pre>
															{:else}
																N/A
															{/if}
														</dd>
													</div>
												</div>

												<!-- Log Section -->
												<div>
													<dt class="text-sm font-medium text-gray-500 dark:text-gray-400">Logs</dt>
													<dd class="mt-1">
														{#if logs[step.name] === undefined}
															<p class="text-gray-600 dark:text-gray-400 italic">Loading logs...</p>
														{:else if logs[step.name].length > 0}
															<div class="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-auto">
																{#each logs[step.name] as log}
																	<div class="flex items-start space-x-2 text-sm font-mono">
																		<span class="text-gray-400 text-xs whitespace-nowrap">{formatDate(log.timestamp)}</span>
																		<span class="text-gray-100 {log.is_stderr ? 'text-red-400' : ''}">{log.message}</span>
																	</div>
																{/each}
															</div>
														{:else}
															<p class="text-gray-600 dark:text-gray-400 italic">No logs available</p>
														{/if}
													</dd>
												</div>
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-gray-600 dark:text-gray-400">No steps available for this job.</p>
					{/if}
				</div>
			</Card>

			<!-- Runner Logs -->
			<Card>
				<div class="p-6">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Runner Logs</h3>
					{#if logs["-"] === undefined}
						<p class="text-gray-600 dark:text-gray-400 italic">Loading logs...</p>
					{:else if logs["-"].length > 0}
						<div class="bg-gray-900 dark:bg-gray-800 rounded-lg p-4 max-h-64 overflow-auto">
							{#each logs["-"] as log}
								<div class="flex items-start space-x-2 text-sm font-mono">
									<span class="text-gray-400 text-xs whitespace-nowrap">{formatDate(log.timestamp)}</span>
									<span class="text-gray-100 {log.is_stderr ? 'text-red-400' : ''}">{log.message}</span>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-gray-600 dark:text-gray-400 italic">No logs available</p>
					{/if}
				</div>
			</Card>

		</div>



	{:else}
		<Card class="max-w-none mb-6">
			<h3 class="text-lg font-semibold text-gray-900">Loading...</h3>
			<p class="text-gray-600">Fetching job details...</p>
		</Card>
	{/if}
</div>

<style>
    pre {
        white-space: pre-wrap;
        word-wrap: break-word;
    }
</style>