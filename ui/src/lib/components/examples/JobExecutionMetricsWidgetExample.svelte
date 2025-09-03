<script lang="ts">
	import { JobExecutionMetricsWidget } from '$lib/components';
	import type { JobExecutionMetrics } from '$lib/types';

	// Mock data for demonstration
	const mockMetrics: JobExecutionMetrics = {
		today: {
			total_jobs: 142,
			success_count: 135,
			failure_count: 7,
			success_rate: 95.07
		},
		status_distribution: {
			running: 3,
			completed: 135,
			failed: 7,
			queued: 2
		},
		top_failing_workflows: [
			{
				workflow_name: 'data-sync',
				failure_rate: 15.2,
				total_executions: 23
			},
			{
				workflow_name: 'backup-process',
				failure_rate: 8.5,
				total_executions: 47
			}
		],
		average_execution_time: 42.8
	};

	const mockMetricsNoFailures: JobExecutionMetrics = {
		today: {
			total_jobs: 100,
			success_count: 100,
			failure_count: 0,
			success_rate: 100
		},
		status_distribution: {
			running: 2,
			completed: 98,
			failed: 0,
			queued: 1
		},
		top_failing_workflows: [],
		average_execution_time: 35.2
	};

	let currentExample = $state('normal');
	let loading = $state(false);
	let error = $state<string | null>(null);

	function simulateLoading() {
		loading = true;
		error = null;
		setTimeout(() => {
			loading = false;
		}, 2000);
	}

	function simulateError() {
		loading = false;
		error = 'Failed to load job execution metrics';
	}

	function handleRetry() {
		error = null;
		simulateLoading();
	}

	function resetToNormal() {
		loading = false;
		error = null;
		currentExample = 'normal';
	}
</script>

<div class="space-y-8 p-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white">JobExecutionMetricsWidget Examples</h1>
		<p class="mt-2 text-gray-600 dark:text-gray-400">
			Interactive examples of the JobExecutionMetricsWidget component in different states.
		</p>
	</div>

	<!-- Controls -->
	<div class="flex flex-wrap gap-2">
		<button
			onclick={resetToNormal}
			class="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
		>
			Normal State
		</button>
		<button
			onclick={() => currentExample = 'no-failures'}
			class="rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
		>
			No Failures
		</button>
		<button
			onclick={simulateLoading}
			class="rounded-md bg-yellow-600 px-3 py-2 text-sm font-medium text-white hover:bg-yellow-700"
		>
			Loading State
		</button>
		<button
			onclick={simulateError}
			class="rounded-md bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
		>
			Error State
		</button>
		<button
			onclick={() => currentExample = 'no-data'}
			class="rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white hover:bg-gray-700"
		>
			No Data
		</button>
	</div>

	<!-- Widget Examples -->
	<div class="space-y-8">
		{#if currentExample === 'normal'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Normal State with Failing Workflows</h2>
				<JobExecutionMetricsWidget
					metrics={mockMetrics}
					{loading}
					{error}
					onRetry={handleRetry}
				/>
			</div>
		{:else if currentExample === 'no-failures'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">All Workflows Performing Well</h2>
				<JobExecutionMetricsWidget
					metrics={mockMetricsNoFailures}
					{loading}
					{error}
					onRetry={handleRetry}
				/>
			</div>
		{:else if currentExample === 'no-data'}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">No Data Available</h2>
				<JobExecutionMetricsWidget
					metrics={undefined}
					{loading}
					{error}
					onRetry={handleRetry}
				/>
			</div>
		{:else}
			<div>
				<h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Current State</h2>
				<JobExecutionMetricsWidget
					metrics={mockMetrics}
					{loading}
					{error}
					onRetry={handleRetry}
				/>
			</div>
		{/if}
	</div>

	<!-- Code Examples -->
	<div class="space-y-4">
		<h2 class="text-lg font-semibold text-gray-900 dark:text-white">Usage Examples</h2>
		
		<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
			<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">Basic Usage</h3>
			<pre class="text-sm text-gray-700 dark:text-gray-300"><code>{`<script>
  import { JobExecutionMetricsWidget } from '$lib/components';
  
  let metrics = {
    today: {
      total_jobs: 142,
      success_count: 135,
      failure_count: 7,
      success_rate: 95.07
    },
    status_distribution: {
      running: 3,
      completed: 135,
      failed: 7,
      queued: 2
    },
    top_failing_workflows: [
      {
        workflow_name: 'data-sync',
        failure_rate: 15.2,
        total_executions: 23
      }
    ],
    average_execution_time: 42.8
  };
</script>

<JobExecutionMetricsWidget {metrics} />`}</code></pre>
		</div>

		<div class="rounded-lg bg-gray-100 p-4 dark:bg-gray-800">
			<h3 class="text-sm font-medium text-gray-900 dark:text-white mb-2">With Loading and Error Handling</h3>
			<pre class="text-sm text-gray-700 dark:text-gray-300"><code>{`<JobExecutionMetricsWidget
  {metrics}
  loading={isLoading}
  error={errorMessage}
  onRetry={handleRetry}
/>`}</code></pre>
		</div>
	</div>
</div>