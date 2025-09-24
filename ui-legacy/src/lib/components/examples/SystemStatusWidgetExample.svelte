<script lang="ts">
	import { SystemStatusWidget } from '$lib/components';
	import type { SystemStatus } from '$lib/types';

	// Example system status data
	const exampleSystemStatus: SystemStatus = {
		active_workers: 3,
		idle_workers: 1,
		total_jobs_today: 142,
		system_uptime: 'P2DT14H30M', // 2 days, 14 hours, 30 minutes
		average_execution_time_24h: 45.2,
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
				timestamp: '2024-01-15T11:00:00Z',
				source: 'database-monitor'
			}
		]
	};

	const exampleSystemStatusNoAlerts: SystemStatus = {
		active_workers: 5,
		idle_workers: 2,
		total_jobs_today: 89,
		system_uptime: 'PT6H15M', // 6 hours, 15 minutes
		average_execution_time_24h: 32.1,
		alerts: []
	};

	let currentExample = $state<'with-alerts' | 'no-alerts' | 'loading' | 'error'>('with-alerts');
	let isRetrying = $state(false);

	function handleRetry() {
		isRetrying = true;
		setTimeout(() => {
			isRetrying = false;
			currentExample = 'with-alerts';
		}, 1000);
	}
</script>

<div class="space-y-8 p-6">
	<div>
		<h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-4">
			SystemStatusWidget Examples
		</h1>
		<p class="text-gray-600 dark:text-gray-400 mb-6">
			Interactive examples of the SystemStatusWidget component in different states.
		</p>

		<!-- State Controls -->
		<div class="flex flex-wrap gap-2 mb-8">
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg border 
					{currentExample === 'with-alerts' 
						? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
						: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}"
				onclick={() => currentExample = 'with-alerts'}
			>
				With Alerts
			</button>
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg border 
					{currentExample === 'no-alerts' 
						? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
						: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}"
				onclick={() => currentExample = 'no-alerts'}
			>
				No Alerts
			</button>
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg border 
					{currentExample === 'loading' 
						? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
						: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}"
				onclick={() => currentExample = 'loading'}
			>
				Loading State
			</button>
			<button
				class="px-4 py-2 text-sm font-medium rounded-lg border 
					{currentExample === 'error' 
						? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800' 
						: 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'}"
				onclick={() => currentExample = 'error'}
			>
				Error State
			</button>
		</div>
	</div>

	<!-- Widget Examples -->
	<div class="border border-gray-200 rounded-lg p-6 dark:border-gray-700">
		{#if currentExample === 'with-alerts'}
			<SystemStatusWidget 
				systemStatus={exampleSystemStatus}
				onRetry={handleRetry}
			/>
		{:else if currentExample === 'no-alerts'}
			<SystemStatusWidget 
				systemStatus={exampleSystemStatusNoAlerts}
				onRetry={handleRetry}
			/>
		{:else if currentExample === 'loading'}
			<SystemStatusWidget 
				loading={true}
				onRetry={handleRetry}
			/>
		{:else if currentExample === 'error'}
			<SystemStatusWidget 
				error="Failed to load system status data"
				onRetry={handleRetry}
			/>
		{/if}
	</div>

	<!-- Code Examples -->
	<div class="space-y-4">
		<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Usage Examples</h2>
		
		<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
			<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Basic Usage</h3>
			<pre class="text-sm text-gray-600 dark:text-gray-400 overflow-x-auto"><code>{`<script>
  import { SystemStatusWidget } from '$lib/components';
  
  let systemStatus = {
    active_workers: 3,
    idle_workers: 1,
    total_jobs_today: 142,
    system_uptime: 'P2DT14H30M',
    average_execution_time_24h: 45.2,
    alerts: []
  };
</script>

<SystemStatusWidget {systemStatus} />`}</code></pre>
		</div>

		<div class="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
			<h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">With Error Handling</h3>
			<pre class="text-sm text-gray-600 dark:text-gray-400 overflow-x-auto"><code>{`<script>
  import { SystemStatusWidget } from '$lib/components';
  
  let loading = false;
  let error = null;
  let systemStatus = null;
  
  async function fetchSystemStatus() {
    loading = true;
    error = null;
    try {
      const response = await fetch('/api/dashboard/system-status');
      systemStatus = await response.json();
    } catch (err) {
      error = err.message;
    } finally {
      loading = false;
    }
  }
</script>

<SystemStatusWidget 
  {systemStatus}
  {loading}
  {error}
  onRetry={fetchSystemStatus}
/>`}</code></pre>
		</div>
	</div>
</div>