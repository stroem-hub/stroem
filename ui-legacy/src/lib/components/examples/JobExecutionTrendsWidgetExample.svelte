<script lang="ts">
	import { JobExecutionTrendsWidget } from '$lib/components';
	import type { JobTrendsData } from '$lib/types';

	// Mock data for different time ranges
	const mockData: Record<string, JobTrendsData> = {
		'1h': {
			time_series: [
				{ timestamp: '2024-01-15T10:00:00Z', total_jobs: 5, successful_jobs: 4, failed_jobs: 1 },
				{ timestamp: '2024-01-15T10:15:00Z', total_jobs: 3, successful_jobs: 3, failed_jobs: 0 },
				{ timestamp: '2024-01-15T10:30:00Z', total_jobs: 7, successful_jobs: 6, failed_jobs: 1 },
				{ timestamp: '2024-01-15T10:45:00Z', total_jobs: 4, successful_jobs: 3, failed_jobs: 1 },
				{ timestamp: '2024-01-15T11:00:00Z', total_jobs: 6, successful_jobs: 5, failed_jobs: 1 }
			],
			time_range: '1h'
		},
		'24h': {
			time_series: [
				{ timestamp: '2024-01-15T00:00:00Z', total_jobs: 12, successful_jobs: 10, failed_jobs: 2 },
				{ timestamp: '2024-01-15T04:00:00Z', total_jobs: 8, successful_jobs: 7, failed_jobs: 1 },
				{ timestamp: '2024-01-15T08:00:00Z', total_jobs: 25, successful_jobs: 22, failed_jobs: 3 },
				{ timestamp: '2024-01-15T12:00:00Z', total_jobs: 18, successful_jobs: 16, failed_jobs: 2 },
				{ timestamp: '2024-01-15T16:00:00Z', total_jobs: 22, successful_jobs: 19, failed_jobs: 3 },
				{ timestamp: '2024-01-15T20:00:00Z', total_jobs: 15, successful_jobs: 13, failed_jobs: 2 }
			],
			time_range: '24h'
		},
		'7d': {
			time_series: [
				{ timestamp: '2024-01-09T00:00:00Z', total_jobs: 145, successful_jobs: 132, failed_jobs: 13 },
				{ timestamp: '2024-01-10T00:00:00Z', total_jobs: 167, successful_jobs: 151, failed_jobs: 16 },
				{ timestamp: '2024-01-11T00:00:00Z', total_jobs: 134, successful_jobs: 125, failed_jobs: 9 },
				{ timestamp: '2024-01-12T00:00:00Z', total_jobs: 189, successful_jobs: 175, failed_jobs: 14 },
				{ timestamp: '2024-01-13T00:00:00Z', total_jobs: 156, successful_jobs: 142, failed_jobs: 14 },
				{ timestamp: '2024-01-14T00:00:00Z', total_jobs: 178, successful_jobs: 165, failed_jobs: 13 },
				{ timestamp: '2024-01-15T00:00:00Z', total_jobs: 142, successful_jobs: 135, failed_jobs: 7 }
			],
			time_range: '7d'
		},
		'30d': {
			time_series: [
				{ timestamp: '2024-01-01T00:00:00Z', total_jobs: 1245, successful_jobs: 1156, failed_jobs: 89 },
				{ timestamp: '2024-01-05T00:00:00Z', total_jobs: 1367, successful_jobs: 1289, failed_jobs: 78 },
				{ timestamp: '2024-01-10T00:00:00Z', total_jobs: 1134, successful_jobs: 1067, failed_jobs: 67 },
				{ timestamp: '2024-01-15T00:00:00Z', total_jobs: 1456, successful_jobs: 1378, failed_jobs: 78 },
				{ timestamp: '2024-01-20T00:00:00Z', total_jobs: 1289, successful_jobs: 1198, failed_jobs: 91 },
				{ timestamp: '2024-01-25T00:00:00Z', total_jobs: 1378, successful_jobs: 1289, failed_jobs: 89 },
				{ timestamp: '2024-01-30T00:00:00Z', total_jobs: 1234, successful_jobs: 1167, failed_jobs: 67 }
			],
			time_range: '30d'
		}
	};

	let currentTimeRange: '1h' | '24h' | '7d' | '30d' = $state('24h');
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Simulate loading and error states
	function simulateLoading() {
		loading = true;
		error = null;
		setTimeout(() => {
			loading = false;
		}, 2000);
	}

	function simulateError() {
		loading = false;
		error = 'Failed to fetch job trends data from server';
	}

	function clearError() {
		error = null;
	}

	function handleTimeRangeChange(range: '1h' | '24h' | '7d' | '30d') {
		currentTimeRange = range;
		// In a real app, this would trigger a new API call
		console.log('Time range changed to:', range);
	}

	function handleRetry() {
		console.log('Retrying...');
		clearError();
		simulateLoading();
	}

	let currentData = $derived(mockData[currentTimeRange]);
</script>

<div class="space-y-8 p-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">
			JobExecutionTrendsWidget Examples
		</h1>
		<p class="text-gray-600 dark:text-gray-400">
			Interactive examples of the job execution trends widget component.
		</p>
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
		<button
			type="button"
			onclick={simulateLoading}
			class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
		>
			Simulate Loading
		</button>
		<button
			type="button"
			onclick={simulateError}
			class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
		>
			Simulate Error
		</button>
		<button
			type="button"
			onclick={clearError}
			class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
		>
			Clear Error
		</button>
	</div>

	<!-- Normal State -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Normal State</h2>
		<JobExecutionTrendsWidget
			trendsData={error ? undefined : currentData}
			{loading}
			{error}
			onTimeRangeChange={handleTimeRangeChange}
			onRetry={handleRetry}
		/>
	</div>

	<!-- Loading State -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Loading State</h2>
		<JobExecutionTrendsWidget
			loading={true}
		/>
	</div>

	<!-- Error State -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Error State</h2>
		<JobExecutionTrendsWidget
			error="Network connection failed"
			onRetry={() => console.log('Retry clicked')}
		/>
	</div>

	<!-- Empty State -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Empty State</h2>
		<JobExecutionTrendsWidget
			trendsData={{
				time_series: [],
				time_range: '24h'
			}}
		/>
	</div>

	<!-- Minimal Data -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">Minimal Data</h2>
		<JobExecutionTrendsWidget
			trendsData={{
				time_series: [
					{ timestamp: '2024-01-15T10:00:00Z', total_jobs: 1, successful_jobs: 1, failed_jobs: 0 },
					{ timestamp: '2024-01-15T11:00:00Z', total_jobs: 2, successful_jobs: 1, failed_jobs: 1 }
				],
				time_range: '24h'
			}}
		/>
	</div>

	<!-- High Failure Rate Data -->
	<div>
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">High Failure Rate</h2>
		<JobExecutionTrendsWidget
			trendsData={{
				time_series: [
					{ timestamp: '2024-01-15T08:00:00Z', total_jobs: 20, successful_jobs: 8, failed_jobs: 12 },
					{ timestamp: '2024-01-15T09:00:00Z', total_jobs: 25, successful_jobs: 10, failed_jobs: 15 },
					{ timestamp: '2024-01-15T10:00:00Z', total_jobs: 18, successful_jobs: 6, failed_jobs: 12 },
					{ timestamp: '2024-01-15T11:00:00Z', total_jobs: 22, successful_jobs: 9, failed_jobs: 13 }
				],
				time_range: '24h'
			}}
		/>
	</div>
</div>