<script lang="ts">
	import type { TaskStatistics } from '$lib/types';
	import { CheckCircleIcon, ExclamationCircleIcon, ClockIcon, TrendingUpIcon, TrendingDownIcon, TasksIcon, UserIcon } from '$lib/components/icons';

	interface TaskStatisticsProps {
		statistics: TaskStatistics;
		loading?: boolean;
	}

	let { statistics, loading = false }: TaskStatisticsProps = $props();

	// Helper function to format duration
	function formatDuration(seconds?: number): string {
		if (!seconds) return 'N/A';
		
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

	// Helper function to format success rate
	function formatSuccessRate(rate: number): string {
		return `${Math.round(rate)}%`;
	}

	// Helper function to get success rate color
	function getSuccessRateColor(rate: number): 'green' | 'yellow' | 'red' {
		if (rate >= 90) return 'green';
		if (rate >= 70) return 'yellow';
		return 'red';
	}

	// Helper function to format last execution time
	function formatLastExecution(timestamp?: string): string {
		if (!timestamp) return 'Never executed';
		
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMinutes = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMinutes < 1) return 'Just now';
		if (diffMinutes < 60) return `${diffMinutes}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		if (diffDays < 7) return `${diffDays}d ago`;
		
		return date.toLocaleDateString();
	}

	// Helper function to get status color and icon
	function getStatusDisplay(status?: string) {
		switch (status) {
			case 'success':
				return { color: 'text-green-600 dark:text-green-400', icon: CheckCircleIcon };
			case 'failed':
				return { color: 'text-red-600 dark:text-red-400', icon: ExclamationCircleIcon };
			case 'running':
				return { color: 'text-blue-600 dark:text-blue-400', icon: ClockIcon };
			case 'queued':
				return { color: 'text-yellow-600 dark:text-yellow-400', icon: ClockIcon };
			default:
				return { color: 'text-gray-600 dark:text-gray-400', icon: ClockIcon };
		}
	}

	let successRateColor = $derived(getSuccessRateColor(statistics.success_rate));
	let statusDisplay = $derived(getStatusDisplay(statistics.last_execution?.status));
</script>

<div class="space-y-4">
	{#if loading}
		<!-- Loading skeleton -->
		<div class="animate-pulse space-y-4">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(3) as _}
					<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
						<div class="flex items-center justify-between">
							<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
							<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
						</div>
						<div class="mt-4 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Statistics cards grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Total Executions Card -->
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Executions</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
						<TasksIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{statistics.total_executions.toLocaleString()}
					</p>
				</div>
			</div>

			<!-- Success Rate Card -->
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md 
						{successRateColor === 'green' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 
						 successRateColor === 'yellow' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400' : 
						 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'}">
						<CheckCircleIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold 
						{successRateColor === 'green' ? 'text-green-600 dark:text-green-400' : 
						 successRateColor === 'yellow' ? 'text-yellow-600 dark:text-yellow-400' : 
						 'text-red-600 dark:text-red-400'}">
						{formatSuccessRate(statistics.success_rate)}
					</p>
					{#if statistics.total_executions > 0}
						<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
							{Math.round((statistics.success_rate / 100) * statistics.total_executions)} of {statistics.total_executions} successful
						</p>
					{/if}
				</div>
			</div>

			<!-- Average Duration Card -->
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800">
				<div class="flex items-center justify-between">
					<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Average Duration</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400">
						<ClockIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{formatDuration(statistics.average_duration)}
					</p>
				</div>
			</div>
		</div>

		<!-- Last Execution Info -->
		{#if statistics.last_execution}
			<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Last Execution</h3>
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<!-- Status -->
					<div class="flex items-center space-x-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
							<svelte:component this={statusDisplay.icon} class="h-4 w-4 {statusDisplay.color}" />
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Status</p>
							<p class="text-sm font-semibold capitalize {statusDisplay.color}">
								{statistics.last_execution.status}
							</p>
						</div>
					</div>

					<!-- Time -->
					<div class="flex items-center space-x-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
							<ClockIcon class="h-4 w-4 text-gray-600 dark:text-gray-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">When</p>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">
								{formatLastExecution(statistics.last_execution.timestamp)}
							</p>
						</div>
					</div>

					<!-- Duration -->
					{#if statistics.last_execution.duration}
						<div class="flex items-center space-x-3">
							<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
								<ClockIcon class="h-4 w-4 text-gray-600 dark:text-gray-400" />
							</div>
							<div>
								<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Duration</p>
								<p class="text-sm font-semibold text-gray-900 dark:text-white">
									{formatDuration(statistics.last_execution.duration)}
								</p>
							</div>
						</div>
					{/if}

					<!-- Triggered By -->
					<div class="flex items-center space-x-3">
						<div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
							<UserIcon class="h-4 w-4 text-gray-600 dark:text-gray-400" />
						</div>
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Triggered By</p>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">
								{statistics.last_execution.triggered_by}
							</p>
						</div>
					</div>
				</div>
			</div>
		{:else}
			<!-- No executions -->
			<div class="rounded-lg border border-gray-200 bg-white p-6 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
				<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
					<ClockIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
				</div>
				<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No Executions Yet</h3>
				<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
					This task has not been executed yet. Run it to see execution statistics.
				</p>
			</div>
		{/if}
	{/if}
</div>