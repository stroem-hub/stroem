<script lang="ts">
	import { Card, TaskCardSkeleton, ErrorBoundary } from '$lib/components';
	import TaskStatusBadge from '../atoms/TaskStatusBadge.svelte';
	import { ClockIcon, UserIcon } from '$lib/components/icons';
	import type { EnhancedTask } from '$lib/types';

	interface Props {
		task?: EnhancedTask;
		onclick?: () => void;
		class?: string;
		loading?: boolean;
		error?: string | Error | null;
		onRetry?: () => void;
	}

	let { 
		task, 
		onclick, 
		class: className = '',
		loading = false,
		error = null,
		onRetry
	}: Props = $props();

	// Format duration helper
	function formatDuration(seconds?: number): string {
		if (!seconds) return 'N/A';
		
		if (seconds < 60) {
			return `${Math.round(seconds)}s`;
		} else if (seconds < 3600) {
			return `${Math.round(seconds / 60)}m`;
		} else {
			return `${Math.round(seconds / 3600)}h`;
		}
	}

	// Format timestamp helper
	function formatTimestamp(timestamp?: string): string {
		if (!timestamp) return 'Never';
		
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffHours = diffMs / (1000 * 60 * 60);
		
		if (diffHours < 1) {
			const diffMinutes = Math.round(diffMs / (1000 * 60));
			return `${diffMinutes}m ago`;
		} else if (diffHours < 24) {
			return `${Math.round(diffHours)}h ago`;
		} else {
			const diffDays = Math.round(diffHours / 24);
			return `${diffDays}d ago`;
		}
	}

	// Format triggered by helper
	function formatTriggeredBy(triggeredBy?: string): string {
		if (!triggeredBy) return 'Unknown';
		
		// Parse source_type:source_id format
		const parts = triggeredBy.split(':');
		if (parts.length === 2) {
			const [type, id] = parts;
			switch (type) {
				case 'user':
					return `User: ${id}`;
				case 'schedule':
					return 'Scheduled';
				case 'api':
					return 'API';
				case 'webhook':
					return 'Webhook';
				default:
					return triggeredBy;
			}
		}
		
		return triggeredBy;
	}

	// Determine status for badge
	const lastExecutionStatus = $derived(task?.statistics.last_execution?.status || 'never_executed');
	
	// Calculate success rate percentage
	const successRatePercent = $derived(task ? Math.round(task.statistics.success_rate) : 0);
</script>

{#if loading}
	<TaskCardSkeleton class={className} />
{:else if error}
	<ErrorBoundary 
		{error}
		title="Failed to load task"
		description="There was an error loading this task's information."
		{onRetry}
		class={className}
	/>
{:else if task}
<Card 
	variant="elevated" 
	padding="md"
	class="cursor-pointer hover:shadow-lg transition-all duration-200 {className}"
	{onclick}
	role="button"
	tabindex={0}
	onkeydown={(e) => {
		if ((e.key === 'Enter' || e.key === ' ') && onclick) {
			e.preventDefault();
			onclick();
		}
	}}
	aria-label="View task details for {task.name || task.id}"
>
	{#snippet children()}
		<div class="space-y-4">
			<!-- Header with title and status -->
			<div class="flex items-start justify-between gap-3">
				<div class="flex-1 min-w-0">
					<h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
						{task.name || task.id}
					</h3>
					{#if task.description}
						<p class="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
							{task.description}
						</p>
					{/if}
				</div>
				<div class="flex-shrink-0">
					<TaskStatusBadge status={lastExecutionStatus} size="sm" />
				</div>
			</div>

			<!-- Statistics row -->
			<div class="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
				<!-- Total executions -->
				<div class="flex flex-col">
					<span class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
						Executions
					</span>
					<span class="font-medium text-gray-900 dark:text-gray-100">
						{task.statistics.total_executions}
					</span>
				</div>

				<!-- Success rate -->
				<div class="flex flex-col">
					<span class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
						Success Rate
					</span>
					<span class="font-medium text-gray-900 dark:text-gray-100">
						{task.statistics.total_executions > 0 ? `${successRatePercent}%` : 'N/A'}
					</span>
				</div>

				<!-- Average duration -->
				<div class="flex flex-col col-span-2 sm:col-span-1">
					<span class="text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
						Avg Duration
					</span>
					<span class="font-medium text-gray-900 dark:text-gray-100">
						{formatDuration(task.statistics.average_duration)}
					</span>
				</div>
			</div>

			<!-- Last execution info -->
			{#if task.statistics.last_execution}
				<div class="pt-3 border-t border-gray-200 dark:border-gray-700">
					<div class="flex items-center justify-between text-sm">
						<div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
							<ClockIcon class="w-4 h-4" />
							<span>Last run: {formatTimestamp(task.statistics.last_execution.timestamp)}</span>
						</div>
						<div class="flex items-center gap-2 text-gray-600 dark:text-gray-400">
							<UserIcon class="w-4 h-4" />
							<span class="truncate max-w-24">
								{formatTriggeredBy(task.statistics.last_execution.triggered_by)}
							</span>
						</div>
					</div>
				</div>
			{:else}
				<div class="pt-3 border-t border-gray-200 dark:border-gray-700">
					<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
						<ClockIcon class="w-4 h-4" />
						<span>Never executed</span>
					</div>
				</div>
			{/if}
		</div>
	{/snippet}
</Card>
{:else}
	<!-- Fallback for missing task data -->
	<Card 
		variant="elevated" 
		padding="md"
		class="opacity-50 {className}"
	>
		{#snippet children()}
			<div class="text-center py-4">
				<p class="text-gray-500 dark:text-gray-400">Task data unavailable</p>
			</div>
		{/snippet}
	</Card>
{/if}