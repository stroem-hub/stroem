<script lang="ts">
	import type { PageProps } from './$types';
	import { Card, Badge, Accordion, AccordionItem } from 'flowbite-svelte';
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
		worker_id: string;
		job_id: string;
		success: boolean;
		start_datetime: string; // Assuming ISO string from DateTime<Utc>
		end_datetime: string;   // Assuming ISO string from DateTime<Utc>
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

	let job: { success: boolean; data?: Job; error?: string } = data.job;

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

	onMount(async () => {
		if (job.data) {
			// Fetch job-level logs
			await fetchLogs(job.data.job_id, undefined);
			// Fetch logs for each step
			for (const step of job.data.steps) {
				await fetchLogs(job.data.job_id, step.name);
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
				<Badge color={job.data.success ? 'green' : 'red'} large>
					{job.data.success ? 'Success' : 'Failed'}
				</Badge>
			</div>

			<!-- Job Details Card -->
			<Card class="max-w-none">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Details</h3>
				<dl class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<dt class="text-sm font-medium text-gray-500">Worker ID</dt>
						<dd class="mt-1 text-gray-900">{job.data.worker_id}</dd>
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
						<dd class="mt-1 text-gray-900">{formatDate(job.data.start_datetime)}</dd>
					</div>
					<div>
						<dt class="text-sm font-medium text-gray-500">End Time</dt>
						<dd class="mt-1 text-gray-900">{formatDate(job.data.end_datetime)}</dd>
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

			<!-- Steps Accordion -->
			<Card class="max-w-none">
				<h3 class="text-lg font-semibold text-gray-900 mb-4">Steps</h3>
				{#if job.data.steps.length > 0}
					<Accordion>
						{#each job.data.steps as step}
							<AccordionItem>
								<span slot="header" class="flex items-center space-x-2">
									<Badge color={step.success ? 'green' : 'red'}>{step.success ? 'Success' : 'Failed'}</Badge>
									<span>{step.name}</span>
								</span>
								<div class="space-y-4">
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

							</AccordionItem>
						{/each}
					</Accordion>
				{:else}
					<p class="text-gray-600">No steps available for this job.</p>
				{/if}
			</Card>

			<!-- Runner logs Accordion -->
					<Accordion>
							<AccordionItem>
								<span slot="header" class="flex items-center space-x-2">
									<span>Runner logs</span>
								</span>

								<div>
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
							</AccordionItem>
					</Accordion>

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