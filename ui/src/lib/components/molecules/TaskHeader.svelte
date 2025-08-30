<script lang="ts">
	import type { EnhancedTask } from '$lib/types';
	import { Button, Breadcrumb } from '$lib/components';
	import { TasksIcon, ClockIcon, CheckCircleIcon, ExclamationCircleIcon } from '$lib/components/icons';
	interface TaskHeaderProps {
		task: EnhancedTask;
		loading?: boolean;
		runDisabled?: boolean;
		onRunTask?: () => void;
	}

	let { 
		task, 
		loading = false,
		runDisabled = false,
		onRunTask
	}: TaskHeaderProps = $props();

	function handleRunTask() {
		onRunTask?.();
	}

	// Helper function to format success rate
	function formatSuccessRate(rate: number): string {
		return `${Math.round(rate)}%`;
	}

	// Helper function to get success rate color
	function getSuccessRateColor(rate: number): string {
		if (rate >= 90) return 'text-green-600 dark:text-green-400';
		if (rate >= 70) return 'text-yellow-600 dark:text-yellow-400';
		return 'text-red-600 dark:text-red-400';
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

	// Helper function to get status icon and color
	function getStatusDisplay(status?: string) {
		switch (status) {
			case 'success':
				return { 
					icon: CheckCircleIcon, 
					color: 'text-green-600 dark:text-green-400',
					bgColor: 'bg-green-50 dark:bg-green-900/20'
				};
			case 'failed':
				return { 
					icon: ExclamationCircleIcon, 
					color: 'text-red-600 dark:text-red-400',
					bgColor: 'bg-red-50 dark:bg-red-900/20'
				};
			case 'running':
				return { 
					icon: ClockIcon, 
					color: 'text-blue-600 dark:text-blue-400',
					bgColor: 'bg-blue-50 dark:bg-blue-900/20'
				};
			case 'queued':
				return { 
					icon: ClockIcon, 
					color: 'text-yellow-600 dark:text-yellow-400',
					bgColor: 'bg-yellow-50 dark:bg-yellow-900/20'
				};
			default:
				return { 
					icon: ClockIcon, 
					color: 'text-gray-600 dark:text-gray-400',
					bgColor: 'bg-gray-50 dark:bg-gray-900/20'
				};
		}
	}

	// Breadcrumb items
	const breadcrumbItems = [
		{ label: 'Tasks', href: '/tasks' },
		{ label: task.name || task.id }
	];

	let statusDisplay = $derived(getStatusDisplay(task.statistics.last_execution?.status));
	let successRateColor = $derived(getSuccessRateColor(task.statistics.success_rate));
</script>

<div class="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
	<div class="px-6 py-6">
		{#if loading}
			<!-- Loading skeleton -->
			<div class="animate-pulse">
				<!-- Breadcrumb skeleton -->
				<div class="mb-4 h-4 w-48 rounded bg-gray-200 dark:bg-gray-700"></div>
				
				<!-- Header content skeleton -->
				<div class="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
					<div class="flex-1">
						<div class="mb-2 h-8 w-64 rounded bg-gray-200 dark:bg-gray-700"></div>
						<div class="h-4 w-96 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
					<div class="h-10 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
				</div>
				
				<!-- Stats skeleton -->
				<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{#each Array(4) as _}
						<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
							<div class="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
							<div class="mt-2 h-6 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<!-- Breadcrumb navigation -->
			<div class="mb-4">
				<Breadcrumb items={breadcrumbItems} />
			</div>

			<!-- Header content -->
			<div class="flex flex-col space-y-4 lg:flex-row lg:items-start lg:justify-between lg:space-y-0">
				<div class="flex-1">
					<div class="flex items-center space-x-3">
						<div class="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/20">
							<TasksIcon class="h-6 w-6 text-blue-600 dark:text-blue-400" />
						</div>
						<div>
							<h1 class="text-2xl font-bold text-gray-900 dark:text-white lg:text-3xl">
								{task.name || task.id}
							</h1>
							{#if task.description}
								<p class="mt-1 text-gray-600 dark:text-gray-400">
									{task.description}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Run Task Button -->
				<div class="flex-shrink-0">
					<Button
						variant="primary"
						disabled={runDisabled}
						onclick={handleRunTask}
						class="w-full sm:w-auto"
					>
						Run Task
					</Button>
				</div>
			</div>

			<!-- Key Statistics -->
			<div class="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				<!-- Total Executions -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Runs</p>
							<p class="text-2xl font-bold text-gray-900 dark:text-white">
								{task.statistics.total_executions.toLocaleString()}
							</p>
						</div>
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 dark:bg-blue-900/20">
							<TasksIcon class="h-4 w-4 text-blue-600 dark:text-blue-400" />
						</div>
					</div>
				</div>

				<!-- Success Rate -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
							<p class="text-2xl font-bold {successRateColor}">
								{formatSuccessRate(task.statistics.success_rate)}
							</p>
						</div>
						<div class="flex h-8 w-8 items-center justify-center rounded-md {statusDisplay.bgColor}">
							<CheckCircleIcon class="h-4 w-4 {successRateColor}" />
						</div>
					</div>
				</div>

				<!-- Last Execution -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Last Run</p>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">
								{formatLastExecution(task.statistics.last_execution?.timestamp)}
							</p>
							{#if task.statistics.last_execution?.status}
								<p class="text-xs capitalize {statusDisplay.color}">
									{task.statistics.last_execution.status}
								</p>
							{/if}
						</div>
						<div class="flex h-8 w-8 items-center justify-center rounded-md {statusDisplay.bgColor}">
							<svelte:component this={statusDisplay.icon} class="h-4 w-4 {statusDisplay.color}" />
						</div>
					</div>
				</div>

				<!-- Average Duration -->
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Duration</p>
							<p class="text-sm font-semibold text-gray-900 dark:text-white">
								{#if task.statistics.average_duration}
									{#if task.statistics.average_duration < 60}
										{Math.round(task.statistics.average_duration)}s
									{:else if task.statistics.average_duration < 3600}
										{Math.floor(task.statistics.average_duration / 60)}m {Math.round(task.statistics.average_duration % 60)}s
									{:else}
										{Math.floor(task.statistics.average_duration / 3600)}h {Math.floor((task.statistics.average_duration % 3600) / 60)}m
									{/if}
								{:else}
									N/A
								{/if}
							</p>
						</div>
						<div class="flex h-8 w-8 items-center justify-center rounded-md bg-purple-50 dark:bg-purple-900/20">
							<ClockIcon class="h-4 w-4 text-purple-600 dark:text-purple-400" />
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>