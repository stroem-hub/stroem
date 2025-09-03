<script lang="ts">
	import { RecentActivityWidget } from '$lib/components';
	import type { RecentActivity } from '$lib/types';

	// Mock data for demonstration
	const mockRecentActivity: RecentActivity = {
		recent_jobs: [
			{
				job_id: 'job-abc123def456',
				task_name: 'backup-database',
				status: 'success',
				start_time: '2024-01-15T10:25:00Z',
				duration: 120.5,
				triggered_by: 'scheduler:daily'
			},
			{
				job_id: 'job-def456ghi789',
				task_name: 'sync-user-data',
				status: 'failed',
				start_time: '2024-01-15T10:20:00Z',
				duration: 45.2,
				triggered_by: 'manual:user123'
			},
			{
				job_id: 'job-ghi789jkl012',
				task_name: 'process-message-queue',
				status: 'running',
				start_time: '2024-01-15T10:30:00Z',
				triggered_by: 'webhook:github'
			},
			{
				job_id: 'job-jkl012mno345',
				task_name: 'generate-reports',
				status: 'queued',
				start_time: '2024-01-15T10:35:00Z',
				triggered_by: 'api:dashboard'
			},
			{
				job_id: 'job-mno345pqr678',
				task_name: 'cleanup-temp-files',
				status: 'success',
				start_time: '2024-01-15T10:15:00Z',
				duration: 8.7,
				triggered_by: 'scheduler:hourly'
			}
		],
		alerts: [
			{
				id: 'alert-001',
				severity: 'warning',
				message: 'Worker node-02 has been idle for 2 hours',
				timestamp: '2024-01-15T10:30:00Z',
				source: 'worker-monitor'
			},
			{
				id: 'alert-002',
				severity: 'error',
				message: 'Database connection timeout detected',
				timestamp: '2024-01-15T10:25:00Z',
				source: 'database-monitor'
			},
			{
				id: 'alert-003',
				severity: 'info',
				message: 'Scheduled maintenance window starting in 1 hour',
				timestamp: '2024-01-15T10:20:00Z',
				source: 'maintenance-scheduler'
			}
		],
		upcoming_jobs: [
			{
				task_name: 'cleanup-logs',
				scheduled_time: '2024-01-15T12:00:00Z',
				trigger_type: 'cron',
				estimated_duration: 30
			},
			{
				task_name: 'weekly-report-generation',
				scheduled_time: '2024-01-15T14:00:00Z',
				trigger_type: 'schedule',
				estimated_duration: 180
			},
			{
				task_name: 'backup-verification',
				scheduled_time: '2024-01-15T16:30:00Z',
				trigger_type: 'cron',
				estimated_duration: 45
			},
			{
				task_name: 'system-health-check',
				scheduled_time: '2024-01-15T18:00:00Z',
				trigger_type: 'schedule'
			}
		]
	};

	const emptyRecentActivity: RecentActivity = {
		recent_jobs: [],
		alerts: [],
		upcoming_jobs: []
	};

	let currentExample = $state<'normal' | 'empty' | 'loading' | 'error'>('normal');
	let retryCount = $state(0);

	function handleRetry() {
		retryCount++;
		console.log('Retry clicked, count:', retryCount);
	}

	function switchExample(type: 'normal' | 'empty' | 'loading' | 'error') {
		currentExample = type;
	}
</script>

<div class="space-y-8">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
			RecentActivityWidget Examples
		</h1>
		<p class="text-gray-600 dark:text-gray-400 mb-6">
			Interactive examples of the RecentActivityWidget component in different states.
		</p>

		<!-- Example Controls -->
		<div class="flex flex-wrap gap-2 mb-8">
			<button
				onclick={() => switchExample('normal')}
				class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors
					{currentExample === 'normal' 
						? 'bg-blue-600 text-white border-blue-600' 
						: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}"
			>
				Normal State
			</button>
			<button
				onclick={() => switchExample('empty')}
				class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors
					{currentExample === 'empty' 
						? 'bg-blue-600 text-white border-blue-600' 
						: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}"
			>
				Empty State
			</button>
			<button
				onclick={() => switchExample('loading')}
				class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors
					{currentExample === 'loading' 
						? 'bg-blue-600 text-white border-blue-600' 
						: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}"
			>
				Loading State
			</button>
			<button
				onclick={() => switchExample('error')}
				class="px-4 py-2 text-sm font-medium rounded-lg border transition-colors
					{currentExample === 'error' 
						? 'bg-blue-600 text-white border-blue-600' 
						: 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700'}"
			>
				Error State
			</button>
		</div>
	</div>

	<!-- Widget Examples -->
	<div class="max-w-4xl">
		{#if currentExample === 'normal'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Normal State</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Widget displaying recent activity with jobs, alerts, and upcoming scheduled tasks.
				</p>
				<RecentActivityWidget 
					recentActivity={mockRecentActivity}
					onRetry={handleRetry}
				/>
			</div>
		{:else if currentExample === 'empty'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Empty State</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Widget when there are no recent jobs, alerts, or upcoming tasks.
				</p>
				<RecentActivityWidget 
					recentActivity={emptyRecentActivity}
					onRetry={handleRetry}
				/>
			</div>
		{:else if currentExample === 'loading'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Loading State</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Widget showing loading skeleton while data is being fetched.
				</p>
				<RecentActivityWidget 
					loading={true}
					onRetry={handleRetry}
				/>
			</div>
		{:else if currentExample === 'error'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Error State</h2>
				<p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
					Widget showing error state with retry functionality. Retry count: {retryCount}
				</p>
				<RecentActivityWidget 
					error="Failed to load recent activity data from the server"
					onRetry={handleRetry}
				/>
			</div>
		{/if}
	</div>

	<!-- Feature Documentation -->
	<div class="mt-12 space-y-6">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Features</h2>
		
		<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Recent Job Executions</h3>
				<ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
					<li>• Real-time feed of last 10 job executions</li>
					<li>• Status indicators with color coding</li>
					<li>• Duration and trigger information</li>
					<li>• Clickable navigation to job details</li>
					<li>• Truncated job IDs for readability</li>
				</ul>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">System Alerts</h3>
				<ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
					<li>• Worker disconnections and failures</li>
					<li>• Authentication and security alerts</li>
					<li>• Severity-based color coding</li>
					<li>• Relative timestamp display</li>
					<li>• Source system identification</li>
				</ul>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Upcoming Jobs</h3>
				<ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
					<li>• Next 5 scheduled executions</li>
					<li>• Estimated completion times</li>
					<li>• Trigger type information</li>
					<li>• Clickable navigation to task details</li>
					<li>• Relative time until execution</li>
				</ul>
			</div>

			<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
				<h3 class="text-lg font-medium text-gray-900 dark:text-white mb-3">Interactive Features</h3>
				<ul class="text-sm text-gray-600 dark:text-gray-400 space-y-2">
					<li>• Keyboard navigation support</li>
					<li>• Loading and error states</li>
					<li>• Retry functionality</li>
					<li>• Responsive design</li>
					<li>• Accessibility compliance</li>
				</ul>
			</div>
		</div>
	</div>
</div>