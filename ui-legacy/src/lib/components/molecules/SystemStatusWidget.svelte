<script lang="ts">
	import type { SystemStatusWidgetProps, SystemAlert } from '$lib/types';
	import { 
		ErrorBoundary, 
		MetricCard, 
		Alert,
		Button
	} from '$lib/components';
	import { 
		TasksIcon, 
		ClockIcon, 
		CheckCircleIcon,
		ExclamationTriangleIcon,
		ExclamationCircleIcon,
		InformationCircleIcon,
		ArrowPathIcon
	} from '$lib/components/icons';
	import SystemStatusSkeleton from '../atoms/SystemStatusSkeleton.svelte';

	let {
		systemStatus,
		loading = false,
		error = null,
		onRetry
	}: SystemStatusWidgetProps = $props();

	// Debug logging for received props
	$effect(() => {
		if (typeof window !== 'undefined') {
			console.log('🏥 SystemStatusWidget: Received props:', {
				systemStatus,
				loading,
				error,
				hasOnRetry: !!onRetry
			});
			
			if (systemStatus) {
				console.log('🏥 SystemStatusWidget: systemStatus structure:', {
					keys: Object.keys(systemStatus),
					active_workers: systemStatus.active_workers,
					idle_workers: systemStatus.idle_workers,
					total_jobs_today: systemStatus.total_jobs_today,
					system_uptime: systemStatus.system_uptime,
					average_execution_time_24h: systemStatus.average_execution_time_24h,
					alerts: systemStatus.alerts
				});
			} else {
				console.log('🏥 SystemStatusWidget: systemStatus is null/undefined');
			}
		}
	});

	// Helper function to format uptime from ISO 8601 duration
	function formatUptime(uptimeDuration?: string): string {
		if (!uptimeDuration) return 'Unknown';
		
		try {
			// Parse ISO 8601 duration format (e.g., "P2DT14H30M")
			const match = uptimeDuration.match(/P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?/);
			if (!match) return uptimeDuration;

			const days = parseInt(match[1] || '0');
			const hours = parseInt(match[2] || '0');
			const minutes = parseInt(match[3] || '0');

			if (days > 0) {
				return `${days}d ${hours}h`;
			} else if (hours > 0) {
				return `${hours}h ${minutes}m`;
			} else {
				return `${minutes}m`;
			}
		} catch {
			return uptimeDuration;
		}
	}

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

	// Helper function to get alert icon and color
	function getAlertDisplay(severity: SystemAlert['severity']) {
		switch (severity) {
			case 'error':
				return { 
					icon: ExclamationCircleIcon, 
					variant: 'error' as const,
					bgColor: 'bg-red-50 dark:bg-red-900/20',
					borderColor: 'border-red-200 dark:border-red-800'
				};
			case 'warning':
				return { 
					icon: ExclamationTriangleIcon, 
					variant: 'warning' as const,
					bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
					borderColor: 'border-yellow-200 dark:border-yellow-800'
				};
			case 'info':
			default:
				return { 
					icon: InformationCircleIcon, 
					variant: 'info' as const,
					bgColor: 'bg-blue-50 dark:bg-blue-900/20',
					borderColor: 'border-blue-200 dark:border-blue-800'
				};
		}
	}

	// Helper function to format alert timestamp
	function formatAlertTime(timestamp: string): string {
		try {
			const date = new Date(timestamp);
			const now = new Date();
			const diffMs = now.getTime() - date.getTime();
			const diffMinutes = Math.floor(diffMs / (1000 * 60));
			const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

			if (diffMinutes < 1) return 'Just now';
			if (diffMinutes < 60) return `${diffMinutes}m ago`;
			if (diffHours < 24) return `${diffHours}h ago`;
			
			return date.toLocaleDateString();
		} catch {
			return timestamp;
		}
	}

	// Calculate total workers
	let totalWorkers = $derived(
		systemStatus ? systemStatus.active_workers + systemStatus.idle_workers : 0
	);

	// Determine worker status color
	let workerStatusColor = $derived(() => {
		if (!systemStatus) return 'blue';
		if (systemStatus.active_workers === 0) return 'red';
		if (systemStatus.idle_workers === 0) return 'yellow';
		return 'green';
	});
</script>

{#if loading}
	<SystemStatusSkeleton />
{:else if error}
	<ErrorBoundary 
		{error}
		title="Failed to load system status"
		description="Unable to load system status information at this time."
		{onRetry}
	/>
{:else if !systemStatus}
	<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
			<ExclamationTriangleIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
		</div>
		<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">System Status Unavailable</h3>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			System status information is not available at this time.
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
	<div class="space-y-6" role="region" aria-label="System Status Overview">
		<!-- Header -->
		<div>
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">System Status</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Overview of system health and performance metrics
			</p>
		</div>

		<!-- Metrics Grid -->
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			<!-- Active Workers Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="workers-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="workers-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Active Workers
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md 
						{workerStatusColor() === 'green' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 
						 workerStatusColor() === 'yellow' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400' : 
						 workerStatusColor() === 'red' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' :
						 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400'}">
						<TasksIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{systemStatus.active_workers}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						of {totalWorkers} total workers
						{#if systemStatus.idle_workers > 0}
							• {systemStatus.idle_workers} idle
						{/if}
					</p>
				</div>
			</div>

			<!-- Total Jobs Today Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="jobs-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="jobs-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						Jobs Today
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
						<CheckCircleIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{(systemStatus.total_jobs_today || 0).toLocaleString()}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						executed since midnight
					</p>
				</div>
			</div>

			<!-- System Uptime Card -->
			<div 
				class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
				role="article"
				aria-labelledby="uptime-title"
			>
				<div class="flex items-center justify-between">
					<h3 id="uptime-title" class="text-sm font-medium text-gray-600 dark:text-gray-400">
						System Uptime
					</h3>
					<div class="flex h-8 w-8 items-center justify-center rounded-md bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400">
						<ClockIcon class="h-5 w-5" />
					</div>
				</div>
				<div class="mt-4">
					<p class="text-3xl font-bold text-gray-900 dark:text-white">
						{formatUptime(systemStatus.system_uptime)}
					</p>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Avg execution: {formatExecutionTime(systemStatus.average_execution_time_24h)}
					</p>
				</div>
			</div>
		</div>

		<!-- System Alerts Section -->
		{#if systemStatus.alerts && systemStatus.alerts.length > 0}
			<div role="region" aria-label="System Alerts">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
					System Alerts
					<span class="ml-2 inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800 dark:bg-red-900/20 dark:text-red-400">
						{systemStatus.alerts?.length || 0}
					</span>
				</h3>
				<div class="space-y-3">
					{#each systemStatus.alerts as alert (alert.id)}
						{@const alertDisplay = getAlertDisplay(alert.severity)}
						<div 
							class="rounded-lg border p-4 {alertDisplay.bgColor} {alertDisplay.borderColor}"
							role="alert"
							aria-labelledby="alert-{alert.id}"
						>
							<div class="flex items-start space-x-3">
								<div class="flex-shrink-0">
									{#if alert.severity === 'error'}
										<ExclamationCircleIcon class="h-5 w-5 text-red-600 dark:text-red-400" />
									{:else if alert.severity === 'warning'}
										<ExclamationTriangleIcon class="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
									{:else}
										<InformationCircleIcon class="h-5 w-5 text-blue-600 dark:text-blue-400" />
									{/if}
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
										<span class="text-xs {alert.severity === 'error' ? 'text-red-600 dark:text-red-400' : 
											alert.severity === 'warning' ? 'text-yellow-600 dark:text-yellow-400' : 
											'text-blue-600 dark:text-blue-400'}">
											{formatAlertTime(alert.timestamp)}
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
		{:else}
			<!-- No Alerts -->
			<div class="rounded-lg border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-900/20">
				<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
					<CheckCircleIcon class="h-6 w-6 text-green-600 dark:text-green-400" />
				</div>
				<h3 class="mt-4 text-lg font-semibold text-green-900 dark:text-green-200">All Systems Operational</h3>
				<p class="mt-2 text-sm text-green-700 dark:text-green-300">
					No active alerts or warnings detected.
				</p>
			</div>
		{/if}
	</div>
{/if}