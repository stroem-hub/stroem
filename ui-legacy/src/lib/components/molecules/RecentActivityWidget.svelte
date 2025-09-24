<script lang="ts">
	import type { RecentActivityWidgetProps, RecentJob, UpcomingJob, SystemAlert, ExecutionStatus } from '$lib/types';
	import { 
		ErrorBoundary, 
		Button
	} from '$lib/components';
	import { 
		ClockIcon, 
		CheckCircleIcon,
		ExclamationTriangleIcon,
		ExclamationCircleIcon,
		InformationCircleIcon,
		ArrowPathIcon,
		TasksIcon,
		JobsIcon
	} from '$lib/components/icons';
	import RecentActivitySkeleton from '../atoms/RecentActivitySkeleton.svelte';

	let {
		recentActivity,
		loading = false,
		error = null,
		onRetry
	}: RecentActivityWidgetProps = $props();

	// Debug logging for received props
	$effect(() => {
		if (typeof window !== 'undefined') {
			console.log('🔄 RecentActivityWidget: Received props:', {
				recentActivity,
				loading,
				error,
				hasOnRetry: !!onRetry
			});
			
			if (recentActivity) {
				console.log('🔄 RecentActivityWidget: recentActivity structure:', {
					keys: Object.keys(recentActivity),
					recent_jobs: recentActivity.recent_jobs,
					alerts: recentActivity.alerts,
					upcoming_jobs: recentActivity.upcoming_jobs
				});
				
				if (recentActivity.recent_jobs) {
					console.log('🔄 RecentActivityWidget: recent_jobs array:', {
						isArray: Array.isArray(recentActivity.recent_jobs),
						length: recentActivity.recent_jobs.length,
						firstItem: recentActivity.recent_jobs[0]
					});
				}
				
				if (recentActivity.alerts) {
					console.log('🔄 RecentActivityWidget: alerts array:', {
						isArray: Array.isArray(recentActivity.alerts),
						length: recentActivity.alerts.length,
						firstItem: recentActivity.alerts[0]
					});
				}
				
				if (recentActivity.upcoming_jobs) {
					console.log('🔄 RecentActivityWidget: upcoming_jobs array:', {
						isArray: Array.isArray(recentActivity.upcoming_jobs),
						length: recentActivity.upcoming_jobs.length,
						firstItem: recentActivity.upcoming_jobs[0]
					});
				}
			} else {
				console.log('🔄 RecentActivityWidget: recentActivity is null/undefined');
			}
		}
	});

	// Helper function to get status display properties
	function getStatusDisplay(status: ExecutionStatus) {
		switch (status) {
			case 'success':
				return { 
					icon: CheckCircleIcon, 
					color: 'text-green-600 dark:text-green-400',
					bgColor: 'bg-green-50 dark:bg-green-900/20',
					label: 'Success'
				};
			case 'failed':
				return { 
					icon: ExclamationCircleIcon, 
					color: 'text-red-600 dark:text-red-400',
					bgColor: 'bg-red-50 dark:bg-red-900/20',
					label: 'Failed'
				};
			case 'running':
				return { 
					icon: ArrowPathIcon, 
					color: 'text-blue-600 dark:text-blue-400',
					bgColor: 'bg-blue-50 dark:bg-blue-900/20',
					label: 'Running'
				};
			case 'queued':
				return { 
					icon: ClockIcon, 
					color: 'text-yellow-600 dark:text-yellow-400',
					bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
					label: 'Queued'
				};
			default:
				return { 
					icon: InformationCircleIcon, 
					color: 'text-gray-600 dark:text-gray-400',
					bgColor: 'bg-gray-50 dark:bg-gray-900/20',
					label: 'Unknown'
				};
		}
	}

	// Helper function to get alert display properties
	function getAlertDisplay(severity: SystemAlert['severity']) {
		switch (severity) {
			case 'error':
				return { 
					icon: ExclamationCircleIcon, 
					color: 'text-red-600 dark:text-red-400',
					bgColor: 'bg-red-50 dark:bg-red-900/20',
					borderColor: 'border-red-200 dark:border-red-800'
				};
			case 'warning':
				return { 
					icon: ExclamationTriangleIcon, 
					color: 'text-yellow-600 dark:text-yellow-400',
					bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
					borderColor: 'border-yellow-200 dark:border-yellow-800'
				};
			case 'info':
			default:
				return { 
					icon: InformationCircleIcon, 
					color: 'text-blue-600 dark:text-blue-400',
					bgColor: 'bg-blue-50 dark:bg-blue-900/20',
					borderColor: 'border-blue-200 dark:border-blue-800'
				};
		}
	}

	// Helper function to format duration
	function formatDuration(seconds?: number): string {
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

	// Helper function to format relative time
	function formatRelativeTime(timestamp: string): string {
		try {
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
		} catch {
			return timestamp;
		}
	}

	// Helper function to format upcoming time
	function formatUpcomingTime(timestamp: string): string {
		try {
			const date = new Date(timestamp);
			const now = new Date();
			const diffMs = date.getTime() - now.getTime();
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
			const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

			if (diffMs < 0) return 'Overdue';
			if (diffMinutes < 1) return 'Starting now';
			if (diffMinutes < 60) return `in ${diffMinutes}m`;
			if (diffHours < 24) return `in ${diffHours}h`;
			if (diffDays < 7) return `in ${diffDays}d`;
			
			return date.toLocaleDateString();
		} catch {
			return timestamp;
		}
	}

	// Helper function to parse triggered_by
	function formatTriggeredBy(triggeredBy: string): string {
		try {
			const parts = triggeredBy.split(':');
			if (parts.length >= 2) {
				const [type, id] = parts;
				switch (type) {
					case 'scheduler':
						return `Scheduled (${id})`;
					case 'manual':
						return `Manual (${id})`;
					case 'webhook':
						return `Webhook (${id})`;
					case 'api':
						return `API (${id})`;
					default:
						return `${type} (${id})`;
				}
			}
			return triggeredBy;
		} catch {
			return triggeredBy;
		}
	}

	// Navigate to job details
	function viewJobDetails(jobId: string) {
		window.location.href = `/jobs/${jobId}`;
	}

	// Navigate to task details
	function viewTaskDetails(taskName: string) {
		window.location.href = `/tasks/${taskName}`;
	}
</script>

{#if loading}
	<RecentActivitySkeleton />
{:else if error}
	<ErrorBoundary 
		{error}
		title="Failed to load recent activity"
		description="Unable to load recent activity information at this time."
		{onRetry}
	/>
{:else if !recentActivity}
	<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
			<ExclamationTriangleIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
		</div>
		<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">Recent Activity Unavailable</h3>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			Recent activity information is not available at this time.
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
	<div class="space-y-6" role="region" aria-label="Recent Activity">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Recent Activity</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Real-time feed of job executions, alerts, and upcoming tasks
			</p>
		</div>

		<!-- System Alerts Section -->
		{#if recentActivity.alerts && recentActivity.alerts.length > 0}
			<div role="region" aria-label="System Alerts">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					System Alerts
					<span class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
						{recentActivity.alerts?.length || 0}
					</span>
				</h3>
				<div class="space-y-3 mb-6">
					{#each recentActivity.alerts as alert (alert.id)}
						{@const alertDisplay = getAlertDisplay(alert.severity)}
						{@const AlertIconComponent = alertDisplay.icon}
						<div 
							class="rounded-lg border p-4 {alertDisplay.bgColor} {alertDisplay.borderColor}"
							role="alert"
							aria-labelledby="alert-{alert.id}"
						>
							<div class="flex items-start space-x-3">
								<div class="flex-shrink-0">
									<AlertIconComponent class="h-5 w-5 {alertDisplay.color}" />
								</div>
								<div class="flex-1 min-w-0">
									<div class="flex items-center justify-between">
										<p 
											id="alert-{alert.id}"
											class="text-sm font-medium {alert.severity === 'error' ? 'text-red-800 dark:text-red-200' : 
												alert.severity === 'warning' ? 'text-yellow-800 dark:text-yellow-200' : 
												'text-blue-800 dark:text-blue-200'}"
										>
											{alert.message}
										</p>
										<span class="text-xs {alertDisplay.color}">
											{formatRelativeTime(alert.timestamp)}
										</span>
									</div>
									{#if alert.source}
										<p class="mt-1 text-xs {alert.severity === 'error' ? 'text-red-700 dark:text-red-300' : 
											alert.severity === 'warning' ? 'text-yellow-700 dark:text-yellow-300' : 
											'text-blue-700 dark:text-blue-300'}">
											Source: {alert.source}
										</p>
									{/if}
								</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Recent Jobs Section -->
		<div role="region" aria-label="Recent Job Executions">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Recent Job Executions
				{#if recentActivity.recent_jobs && recentActivity.recent_jobs.length > 0}
					<span class="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/20 dark:text-blue-400">
						{recentActivity.recent_jobs?.length || 0}
					</span>
				{/if}
			</h3>
			
			{#if recentActivity.recent_jobs && recentActivity.recent_jobs.length > 0}
				<div class="space-y-3 mb-6">
					{#each recentActivity.recent_jobs as job (job.job_id)}
						{@const statusDisplay = getStatusDisplay(job.status)}
						{@const StatusIconComponent = statusDisplay.icon}
						<div 
							class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
							role="button"
							tabindex="0"
							onclick={() => viewJobDetails(job.job_id)}
							onkeydown={(e) => e.key === 'Enter' && viewJobDetails(job.job_id)}
							aria-label="View job details for {job.task_name}"
						>
							<div class="flex items-start justify-between">
								<div class="flex items-start space-x-3 flex-1 min-w-0">
									<div class="flex-shrink-0">
										<div class="flex h-8 w-8 items-center justify-center rounded-md {statusDisplay.bgColor}">
											<StatusIconComponent class="h-5 w-5 {statusDisplay.color}" />
										</div>
									</div>
									<div class="flex-1 min-w-0">
										<div class="flex items-center space-x-2">
											<h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
												{job.task_name}
											</h4>
											<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium {statusDisplay.bgColor} {statusDisplay.color}">
												{statusDisplay.label}
											</span>
										</div>
										<div class="mt-1 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
											<span>ID: {job.job_id.slice(0, 8)}...</span>
											{#if job.duration}
												<span>Duration: {formatDuration(job.duration)}</span>
											{/if}
											<span>{formatTriggeredBy(job.triggered_by)}</span>
										</div>
									</div>
								</div>
								<div class="flex-shrink-0 text-right">
									<span class="text-xs text-gray-500 dark:text-gray-400">
										{formatRelativeTime(job.start_time)}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50 mb-6">
					<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<JobsIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
					</div>
					<h4 class="mt-4 text-sm font-semibold text-gray-900 dark:text-white">No Recent Jobs</h4>
					<p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
						No job executions have been recorded recently.
					</p>
				</div>
			{/if}
		</div>

		<!-- Upcoming Jobs Section -->
		<div role="region" aria-label="Upcoming Scheduled Jobs">
			<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
				Upcoming Scheduled Jobs
				{#if recentActivity.upcoming_jobs && recentActivity.upcoming_jobs.length > 0}
					<span class="ml-2 inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/20 dark:text-green-400">
						{recentActivity.upcoming_jobs?.length || 0}
					</span>
				{/if}
			</h3>
			
			{#if recentActivity.upcoming_jobs && recentActivity.upcoming_jobs.length > 0}
				<div class="space-y-3">
					{#each recentActivity.upcoming_jobs as upcomingJob (upcomingJob.task_name + upcomingJob.scheduled_time)}
						<div 
							class="rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800 cursor-pointer"
							role="button"
							tabindex="0"
							onclick={() => viewTaskDetails(upcomingJob.task_name)}
							onkeydown={(e) => e.key === 'Enter' && viewTaskDetails(upcomingJob.task_name)}
							aria-label="View task details for {upcomingJob.task_name}"
						>
							<div class="flex items-start justify-between">
								<div class="flex items-start space-x-3 flex-1 min-w-0">
									<div class="flex-shrink-0">
										<div class="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
											<ClockIcon class="h-5 w-5" />
										</div>
									</div>
									<div class="flex-1 min-w-0">
										<h4 class="text-sm font-medium text-gray-900 dark:text-white truncate">
											{upcomingJob.task_name}
										</h4>
										<div class="mt-1 flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
											<span>Trigger: {upcomingJob.trigger_type}</span>
											{#if upcomingJob.estimated_duration}
												<span>Est. duration: {formatDuration(upcomingJob.estimated_duration)}</span>
											{/if}
										</div>
									</div>
								</div>
								<div class="flex-shrink-0 text-right">
									<span class="text-xs font-medium text-green-600 dark:text-green-400">
										{formatUpcomingTime(upcomingJob.scheduled_time)}
									</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center dark:border-gray-700 dark:bg-gray-800/50">
					<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
						<TasksIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
					</div>
					<h4 class="mt-4 text-sm font-semibold text-gray-900 dark:text-white">No Upcoming Jobs</h4>
					<p class="mt-2 text-xs text-gray-600 dark:text-gray-400">
						No jobs are currently scheduled for execution.
					</p>
				</div>
			{/if}
		</div>
	</div>
{/if}