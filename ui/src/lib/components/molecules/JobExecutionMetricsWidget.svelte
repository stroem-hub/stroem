<script lang="ts">
	import type { JobExecutionMetricsWidgetProps } from '$lib/types';
	import { 
		ErrorBoundary, 
		Button,
		Badge
	} from '$lib/components';
	import { 
		TasksIcon, 
		CheckCircleIcon,
		ExclamationCircleIcon,
		ClockIcon,
		ExclamationTriangleIcon,
		ArrowPathIcon,
		TrendingUpIcon,
		TrendingDownIcon
	} from '$lib/components/icons';
	import JobExecutionMetricsSkeleton from '../atoms/JobExecutionMetricsSkeleton.svelte';

	let {
		metrics,
		loading = false,
		error = null,
		onRetry
	}: JobExecutionMetricsWidgetProps = $props();

	// Helper function to format execution time
	function formatExecutionTime(seconds?: number): string {
		if (seconds == null || seconds === undefined) return 'N/A';
		
		if (seconds < 60) {
			return `${Math.round(seconds)}s`;
		} else if (seconds < 3600) {
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = Math.round(seconds % 60);
			return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
		} else {
			const hours = Math.floor(seconds / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
		}
	}

	// Helper function to format percentage
	function formatPercentage(value: number): string {
		return `${Math.round(value * 10) / 10}%`;
	}

	// Helper function to get status badge variant
	function getStatusBadgeVariant(status: string): 'success' | 'error' | 'warning' | 'info' {
		switch (status.toLowerCase()) {
			case 'completed':
				return 'success';
			case 'failed':
				return 'error';
			case 'running':
				return 'warning';
			case 'queued':
				return 'info';
			default:
				return 'info';
		}
	}

	// Helper function to get status icon
	function getStatusIcon(status: string) {
		switch (status.toLowerCase()) {
			case 'completed':
				return CheckCircleIcon;
			case 'failed':
				return ExclamationCircleIcon;
			case 'running':
				return ClockIcon;
			case 'queued':
				return TasksIcon;
			default:
				return TasksIcon;
		}
	}

	// Helper function to get status color classes
	function getStatusColors(status: string) {
		switch (status.toLowerCase()) {
			case 'completed':
				return {
					bg: 'bg-green-50 dark:bg-green-900/20',
					text: 'text-green-600 dark:text-green-400',
					border: 'border-green-200 dark:border-green-800'
				};
			case 'failed':
				return {
					bg: 'bg-red-50 dark:bg-red-900/20',
					text: 'text-red-600 dark:text-red-400',
					border: 'border-red-200 dark:border-red-800'
				};
			case 'running':
				return {
					bg: 'bg-yellow-50 dark:bg-yellow-900/20',
					text: 'text-yellow-600 dark:text-yellow-400',
					border: 'border-yellow-200 dark:border-yellow-800'
				};
			case 'queued':
				return {
					bg: 'bg-blue-50 dark:bg-blue-900/20',
					text: 'text-blue-600 dark:text-blue-400',
					border: 'border-blue-200 dark:border-blue-800'
				};
			default:
				return {
					bg: 'bg-gray-50 dark:bg-gray-900/20',
					text: 'text-gray-600 dark:text-gray-400',
					border: 'border-gray-200 dark:border-gray-800'
				};
		}
	}
</script>

{#if loading}
	<JobExecutionMetricsSkeleton />
{:else if error}
	<ErrorBoundary 
		{error}
		title="Failed to load job execution metrics"
		description="Unable to load job execution metrics at this time."
		{onRetry}
	/>
{:else if !metrics}
	<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
			<ExclamationTriangleIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
		</div>
		<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Job Metrics Unavailable</h3>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Job execution metrics are not available at this time.
		</p>
		{#if onRetry}
			<Button
				variant="outline"
				size="sm"
				onclick={onRetry}
				class="mt-4"
			>
				<ArrowPathIcon class="w-4 h-4 mr-2" />
				Retry
			</Button>
		{/if}
	</div>
{:else}
	<div class="space-y-6" role="region" aria-label="Job Execution Metrics">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Job Execution Metrics</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Today's job performance and execution statistics
			</p>
		</div>

		<!-- Today's Statistics Grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<!-- Total Jobs Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="total-jobs-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="total-jobs-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Total Jobs
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
						<TasksIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{metrics.today.total_jobs.toLocaleString()}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						executed today
					</p>
				</div>
			</div>

			<!-- Success Rate Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="success-rate-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="success-rate-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Success Rate
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
						<CheckCircleIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{formatPercentage(metrics.today.success_rate)}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{metrics.today.success_count} successful
					</p>
				</div>
			</div>

			<!-- Failure Rate Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="failure-rate-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="failure-rate-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Failure Rate
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400">
						<ExclamationCircleIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{formatPercentage(100 - metrics.today.success_rate)}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						{metrics.today.failure_count} failed
					</p>
				</div>
			</div>

			<!-- Average Execution Time Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="avg-time-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="avg-time-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Avg Execution Time
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
						<ClockIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{formatExecutionTime(metrics.average_execution_time)}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						per job
					</p>
				</div>
			</div>
		</div>

		<!-- Job Status Distribution -->
		<div 
			class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
			role="region"
			aria-labelledby="status-distribution-title"
		>
			<h3 id="status-distribution-title" class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Job Status Distribution
			</h3>
			<div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{#each Object.entries(metrics.status_distribution) as [status, count]}
					{@const colors = getStatusColors(status)}
					{@const StatusIcon = getStatusIcon(status)}
					<div class="text-center p-4 rounded-lg border {colors.bg} {colors.border}">
						<div class="flex items-center justify-center mb-2">
							<StatusIcon class="h-6 w-6 {colors.text}" />
						</div>
						<p class="text-2xl font-bold text-gray-900 dark:text-white">
							{count.toLocaleString()}
						</p>
						<p class="text-sm font-medium {colors.text} capitalize">
							{status}
						</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Top Failing Workflows -->
		{#if metrics.top_failing_workflows && metrics.top_failing_workflows.length > 0}
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800"
				role="region"
				aria-labelledby="failing-workflows-title"
			>
				<div class="flex items-center justify-between mb-4">
					<h3 id="failing-workflows-title" class="text-lg font-semibold text-gray-900 dark:text-white">
						Top Failing Workflows
					</h3>
					<Badge variant="error" size="sm">
						{metrics.top_failing_workflows.length} workflows
					</Badge>
				</div>
				<div class="space-y-3">
					{#each metrics.top_failing_workflows as workflow}
						<div class="flex items-center justify-between p-4 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-800">
							<div class="flex-1 min-w-0">
								<div class="flex items-center space-x-2">
									<ExclamationTriangleIcon class="h-4 w-4 text-red-600 dark:text-red-400 flex-shrink-0" />
									<p class="text-sm font-medium text-red-900 dark:text-red-200 truncate">
										{workflow.workflow_name}
									</p>
								</div>
								<p class="mt-1 text-xs text-red-700 dark:text-red-300">
									{workflow.total_executions} total executions
								</p>
							</div>
							<div class="flex items-center space-x-2">
								<TrendingDownIcon class="h-4 w-4 text-red-600 dark:text-red-400" />
								<span class="text-sm font-semibold text-red-900 dark:text-red-200">
									{formatPercentage(workflow.failure_rate)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<!-- No Failing Workflows -->
			<div class="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
				<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
					<TrendingUpIcon class="h-6 w-6 text-green-600 dark:text-green-400" />
				</div>
				<h3 class="mt-4 text-lg font-semibold text-green-900 dark:text-green-200">All Workflows Performing Well</h3>
				<p class="mt-2 text-sm text-green-700 dark:text-green-300">
					No workflows with significant failure rates detected.
				</p>
			</div>
		{/if}
	</div>
{/if}