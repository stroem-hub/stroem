<script lang="ts">
	import { 
		Card, 
		Button, 
		Input, 
		FormField, 
		Tabs, 
		Alert,
		Tooltip
	} from '$lib/components';
	import { TaskHeader, TaskConfiguration, TaskStatistics, Pagination, JobFilters, TaskDurationChart } from '$lib/components';
	import {
		CloseCircleIcon,
		CheckCircleIcon,
		QuestionCircleIcon,
		InfoCircleIcon
	} from '$lib/components/icons';
	import { goto } from '$app/navigation';
	import type { PageProps } from './$types';
	import type { EnhancedTask, TaskJobSummary, PaginationInfo, Task, InputField, JobExecutionPoint } from '$lib/types';
	import { callApi } from '$lib/auth';

	let { data }: PageProps = $props();

	let task = data.task.data as Task;

	// Handle pagination edge cases
	function handlePaginationError(error: any): void {
		console.error('Pagination error:', error);
		jobsLoading = false;
		
		// Reset to first page if current page is invalid
		if (jobsPage > 1) {
			jobsPage = 1;
			updateJobsUrl();
		}
	}

	// Clear loading state when jobs data changes
	$effect(() => {
		if (data.jobs) {
			data.jobs.then(() => {
				jobsLoading = false;
			}).catch(() => {
				jobsLoading = false;
			});
		}
	});

	// Transform current task data to EnhancedTask format
	// This handles the correct API response format with top-level pagination
	function transformToEnhancedTask(basicTask: Task, jobsApiResponse?: any): EnhancedTask {
		let jobs: TaskJobSummary[] = [];
		let totalJobs = 0;

		// Handle correct API response format: { success: true, data: [...], pagination: {...} }
		if (jobsApiResponse?.success && Array.isArray(jobsApiResponse?.data)) {
			jobs = jobsApiResponse.data;
			totalJobs = jobsApiResponse.pagination?.total || jobs.length;
		}
		// Handle direct array format (fallback)
		else if (Array.isArray(jobsApiResponse)) {
			jobs = jobsApiResponse as any;
			totalJobs = jobs.length;
		}
		
		// Calculate statistics from the available job data
		const mockStatistics = {
			total_executions: totalJobs,
			// Note: Success rate is calculated from the current page sample only
			// In a real implementation, this should come from a dedicated statistics API
			success_rate: jobs.length > 0 
				? (jobs.filter((job: TaskJobSummary) => job.success === true).length / jobs.length) * 100 
				: 0,
			last_execution: jobs.length > 0 ? {
				timestamp: jobs[0].start_datetime || '',
				status: jobs[0].success === true ? 'success' as const : 
						jobs[0].success === false ? 'failed' as const : 'running' as const,
				triggered_by: jobs[0].triggered_by || 'unknown',
				duration: jobs[0].duration
			} : undefined,
			average_duration: jobs.length > 0 
				? (() => {
					const validJobs = jobs.filter((job: TaskJobSummary) => job.duration != null && job.duration > 0);
					return validJobs.length > 0 
						? validJobs.reduce((sum: number, job: TaskJobSummary) => sum + (job.duration || 0), 0) / validJobs.length
						: undefined;
				})()
				: undefined
		};

		return {
			id: basicTask.id,
			name: basicTask.name,
			description: basicTask.description || undefined,
			input: basicTask.input,
			flow: basicTask.flow,
			statistics: mockStatistics
		};
	}

	// Create enhanced task data
	let enhancedTask = $derived.by(async () => {
		if (!data.task.success || !data.task.data) return null;
		
		try {
			const jobsData = await data.jobs;
			return transformToEnhancedTask(task, jobsData);
		} catch (error) {
			// Fallback to basic task data with empty statistics
			return transformToEnhancedTask(task);
		}
	});

	// Transform job data for chart visualization
	function transformJobsToChartData(jobsApiResponse?: any): JobExecutionPoint[] {
		let jobs: TaskJobSummary[] = [];

		// Handle the API response format from the page loader
		if (jobsApiResponse?.success && Array.isArray(jobsApiResponse?.data)) {
			jobs = jobsApiResponse.data as TaskJobSummary[];
		}
		// Handle direct array format (fallback)
		else if (Array.isArray(jobsApiResponse)) {
			jobs = jobsApiResponse as any;
		}



		const chartPoints = jobs
			.filter(job => {
				const hasValidData = job.start_datetime && 
									 (job.end_datetime || job.success !== null);

				return hasValidData;
			})
			.map(job => {
				// Calculate duration from start and end times
				let duration = 0;
				if (job.start_datetime && job.end_datetime) {
					const startTime = new Date(job.start_datetime).getTime();
					const endTime = new Date(job.end_datetime).getTime();
					duration = (endTime - startTime) / 1000; // Convert to seconds
				} else if (job.start_datetime && job.success === null) {
					// Job is still running, calculate current duration
					const startTime = new Date(job.start_datetime).getTime();
					const currentTime = new Date().getTime();
					duration = (currentTime - startTime) / 1000;
				}

				return {
					timestamp: job.start_datetime,
					duration: duration,
					status: job.success === true ? 'success' as const : 
							job.success === false ? 'failed' as const : 'running' as const,
					jobId: job.job_id,
					triggeredBy: job.triggered_by || 'unknown'
				};
			})
			.filter(job => job.duration > 0) // Only include jobs with positive duration
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

		return chartPoints;
	}

	// Create chart data
	let chartData = $derived.by(async () => {
		try {
			const jobsData = await data.jobs;
			const transformedData = transformJobsToChartData(jobsData);
			return transformedData;
		} catch (error) {
			console.error('Error transforming chart data:', error);
			return [];
		}
	});

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

	let activeTab = $state('overview');

	// Job pagination and filtering state
	let jobsPage = $state(data.jobsParams.page);
	let jobsLimit = $state(data.jobsParams.limit);
	let jobsStatus = $state(data.jobsParams.status);
	let jobsSort = $state(data.jobsParams.sort as 'start_datetime' | 'end_datetime' | 'duration' | 'status');
	let jobsOrder = $state(data.jobsParams.order as 'asc' | 'desc');
	let jobsLoading = $state(false);

	// Update URL when pagination or filters change
	function updateJobsUrl() {
		const url = new URL(window.location.href);
		url.searchParams.set('page', jobsPage.toString());
		url.searchParams.set('limit', jobsLimit.toString());
		url.searchParams.set('sort', jobsSort);
		url.searchParams.set('order', jobsOrder);
		
		if (jobsStatus) {
			url.searchParams.set('status', jobsStatus);
		} else {
			url.searchParams.delete('status');
		}

		goto(url.pathname + url.search, { replaceState: true, noScroll: true });
	}

	// Job pagination handlers
	async function handleJobsPageChange(newPage: number) {
		jobsLoading = true;
		jobsPage = newPage;
		updateJobsUrl();
		// Loading state will be cleared when the page reloads with new data
	}

	async function handleJobsPageSizeChange(newSize: number) {
		jobsLoading = true;
		jobsLimit = newSize;
		jobsPage = 1; // Reset to first page when changing page size
		updateJobsUrl();
		// Loading state will be cleared when the page reloads with new data
	}

	// Job filter handlers
	function handleJobsStatusChange(newStatus: string | undefined) {
		jobsLoading = true;
		jobsStatus = newStatus;
		jobsPage = 1; // Reset to first page when filtering
		updateJobsUrl();
	}

	function handleJobsSortChange(newSort: string, newOrder: string) {
		jobsLoading = true;
		jobsSort = newSort as 'start_datetime' | 'end_datetime' | 'duration' | 'status';
		jobsOrder = newOrder as 'asc' | 'desc';
		jobsPage = 1; // Reset to first page when sorting
		updateJobsUrl();
	}

	function handleJobsClearFilters() {
		jobsLoading = true;
		jobsStatus = undefined;
		jobsSort = 'start_datetime';
		jobsOrder = 'desc';
		jobsPage = 1;
		updateJobsUrl();
	}

	function handleRunTask() {
		// Switch to the Run tab
		activeTab = 'run';
		
		// Scroll to the tabs section
		setTimeout(() => {
			const tabsSection = document.querySelector('[role="tablist"]');
			if (tabsSection) {
				tabsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}, 100);
	}

	function handleTabChange(tabId: string) {
		activeTab = tabId;
		
		// If switching to activity tab, ensure URL reflects current pagination state
		if (tabId === 'activity') {
			updateJobsUrl();
		}
	}

	function openJob(job_id: string) {
		goto(`/jobs/${job_id}`);
	}

	// Define tabs data with snippets
	const tabsData = [
		{
			id: 'overview',
			title: 'Overview',
			content: overviewTabContent
		},
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

{#snippet overviewTabContent()}
	{#await enhancedTask}
		<!-- Loading state for overview -->
		<div class="space-y-6">
			<TaskStatistics 
				loading={true}
			/>
			<TaskConfiguration 
				loading={true}
			/>
		</div>
	{:then enhancedTaskData}
		{#if enhancedTaskData}
			<div class="space-y-6">
				<!-- Task Statistics Section -->
				<div>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Execution Statistics</h2>
					<TaskStatistics 
						statistics={enhancedTaskData.statistics}
					/>
				</div>

				<!-- Task Configuration Section -->
				<div>
					<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Task Configuration</h2>
					<TaskConfiguration 
						task={enhancedTaskData}
					/>
				</div>
			</div>
		{:else}
			<!-- Fallback when enhanced data is not available -->
			<div class="space-y-6">
				<TaskStatistics 
					error="Statistics unavailable"
					onRetry={() => window.location.reload()}
				/>
				<TaskConfiguration 
					task={{
						...task,
						description: task.description || undefined
					}}
				/>
			</div>
		{/if}
	{:catch error}
		<!-- Error state for overview -->
		<div class="space-y-6">
			<TaskStatistics 
				error={error}
				onRetry={() => window.location.reload()}
			/>
			
			<div>
				<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Task Configuration</h2>
				<TaskConfiguration 
					task={{
						...task,
						description: task.description || undefined
					}}
				/>
			</div>
		</div>
	{/await}
{/snippet}

{#snippet activityTabContent()}
	<div class="space-y-6">
		<!-- Duration Chart -->
		{#await chartData}
			<TaskDurationChart 
				jobHistory={[]}
				loading={true}
			/>
		{:then chartDataPoints}
			<TaskDurationChart 
				jobHistory={chartDataPoints}
				height={300}
				showLegend={true}
			/>
		{:catch error}
			<TaskDurationChart 
				jobHistory={[]}
				error={error}
				onRetry={() => window.location.reload()}
			/>
		{/await}

		<!-- Job Filters -->
		<JobFilters
			status={jobsStatus}
			sort={jobsSort}
			order={jobsOrder}
			onStatusChange={handleJobsStatusChange}
			onSortChange={handleJobsSortChange}
			onClearFilters={handleJobsClearFilters}
		/>

		<!-- Job History Table -->
		{#if jobsLoading}
			<div class="flex items-center justify-center py-8">
				<div class="animate-spin w-8 h-8 border-4 border-gray-300 border-t-primary-500 rounded-full"></div>
				<span class="ml-3 text-gray-600 dark:text-gray-400">Loading job history...</span>
			</div>
		{:else}
			{#await data.jobs}
				<div class="flex items-center justify-center py-8">
					<div class="animate-spin w-8 h-8 border-4 border-gray-300 border-t-primary-500 rounded-full"></div>
					<span class="ml-3 text-gray-600 dark:text-gray-400">Loading job history...</span>
				</div>
		{:then jobsResponse}
			{#if !jobsResponse.success}
				<Card class="max-w-none bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
					{#snippet children()}
						<h3 class="text-lg font-semibold text-red-900 dark:text-red-300">Error</h3>
						<p class="text-red-700 dark:text-red-400">{jobsResponse.error?.message || 'Failed to load job history'}</p>
					{/snippet}
				</Card>
			{:else if jobsResponse.data}
				{@const jobs = jobsResponse.data as TaskJobSummary[]}
				{@const pagination = jobsResponse.pagination as PaginationInfo}
				
				{#if jobs && jobs.length > 0}
					<!-- Jobs Table -->
					<div class="bg-white dark:bg-gray-900 shadow rounded-lg overflow-hidden">
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
								<thead class="bg-gray-50 dark:bg-gray-800">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											Status
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											Started
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											Duration
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											Output
										</th>
										<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
											Triggered by
										</th>
									</tr>
								</thead>
								<tbody class="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
									{#each jobs as job}
										<tr 
											class="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
											onclick={() => openJob(job.job_id)}
											role="button"
											tabindex="0"
											onkeydown={(e) => e.key === 'Enter' && openJob(job.job_id)}
										>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="flex items-center">
													<Tooltip text={job.status || 'Unknown'} placement="right">
														{#snippet children()}
															{#if job.success === null || job.success === undefined}
																<QuestionCircleIcon class="text-yellow-400 dark:text-yellow-400 shrink-0 h-5 w-5" />
															{:else if job.success}
																<CheckCircleIcon class="text-green-400 dark:text-green-400 shrink-0 h-5 w-5" />
															{:else}
																<CloseCircleIcon class="text-red-500 dark:text-red-500 shrink-0 h-5 w-5" />
															{/if}
														{/snippet}
													</Tooltip>
													<span class="ml-2 text-sm text-gray-900 dark:text-gray-100 capitalize">
														{job.status || 'Unknown'}
													</span>
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-900 dark:text-gray-100">
													{#if job.start_datetime}
														{new Date(job.start_datetime).toLocaleString()}
													{:else}
														-
													{/if}
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-900 dark:text-gray-100">
													{#if job.duration !== undefined && job.duration !== null}
														{#if job.duration < 60}
															{job.duration}s
														{:else if job.duration < 3600}
															{Math.floor(job.duration / 60)}m {job.duration % 60}s
														{:else}
															{Math.floor(job.duration / 3600)}h {Math.floor((job.duration % 3600) / 60)}m
														{/if}
													{:else if job.start_datetime && !job.end_datetime}
														<span class="text-yellow-600 dark:text-yellow-400">Running...</span>
													{:else}
														-
													{/if}
												</div>
											</td>
											<td class="px-6 py-4">
												<div class="text-sm text-gray-900 dark:text-gray-100 max-w-xs truncate">
													<span class="text-gray-500 dark:text-gray-400 italic">View job details</span>
												</div>
											</td>
											<td class="px-6 py-4 whitespace-nowrap">
												<div class="text-sm text-gray-900 dark:text-gray-100">
													{job.triggered_by || 'unknown'}
												</div>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<!-- Pagination -->
					<Pagination
						currentPage={pagination.page}
						totalPages={pagination.total_pages}
						totalItems={pagination.total}
						itemsPerPage={pagination.limit}
						onPageChange={handleJobsPageChange}
						onPageSizeChange={handleJobsPageSizeChange}
						loading={jobsLoading}
					/>
				{:else}
					<Card class="max-w-none">
						{#snippet children()}
							<div class="text-center py-8">
								<QuestionCircleIcon class="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" />
								<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No job history</h3>
								<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
									This task hasn't been executed yet.
								</p>
							</div>
						{/snippet}
					</Card>
				{/if}
			{:else}
				<Card class="max-w-none">
					{#snippet children()}
						<p class="text-gray-600 dark:text-gray-400">No job data available</p>
					{/snippet}
				</Card>
			{/if}
			{:catch error}
				<Card class="max-w-none bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
					{#snippet children()}
						<h3 class="text-lg font-semibold text-red-900 dark:text-red-300">Error Loading Jobs</h3>
						<p class="text-red-700 dark:text-red-400">
							{error?.message || 'Failed to load job history'}
						</p>
						<Button
							class="mt-4"
							onclick={() => {
								jobsLoading = false;
								handlePaginationError(error);
							}}
						>
							Retry
						</Button>
					{/snippet}
				</Card>
			{/await}
		{/if}
	</div>
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

{#if !data.task.success}
	<div class="p-6">
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
	</div>
{:else if data.task.data}
	{#await enhancedTask}
		<!-- Loading state with TaskHeader skeleton -->
		<TaskHeader 
			loading={true}
		/>
	{:then enhancedTaskData}
		{#if enhancedTaskData}
			<!-- Enhanced TaskHeader with statistics -->
			<TaskHeader 
				task={enhancedTaskData}
				onRunTask={handleRunTask}
			/>
		{:else}
			<!-- Fallback TaskHeader without statistics -->
			<TaskHeader 
				task={{
					id: task.id,
					name: task.name,
					description: task.description || undefined,
					input: task.input,
					flow: task.flow,
					statistics: {
						total_executions: 0,
						success_rate: 0
					}
				}}
				onRunTask={handleRunTask}
			/>
		{/if}
	{:catch error}
		<!-- Error state with TaskHeader -->
		<TaskHeader 
			error={error}
			onRetry={() => window.location.reload()}
			onRunTask={handleRunTask}
		/>
	{/await}

	<!-- Tabs content -->
	<div class="p-6">
		<Tabs 
			tabs={tabsData} 
			activeTab={activeTab}
			onTabChange={handleTabChange}
		/>
	</div>
{:else}
	<div class="p-6">
		<Card class="max-w-none mb-6">
			{#snippet children()}
				<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">Loading...</h3>
				<p class="text-gray-600 dark:text-gray-400">Fetching task details...</p>
			{/snippet}
		</Card>
	</div>
{/if}
