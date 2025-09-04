<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import SystemStatusWidget from '$lib/components/molecules/SystemStatusWidget.svelte';
	import JobExecutionMetricsWidget from '$lib/components/molecules/JobExecutionMetricsWidget.svelte';
	import RecentActivityWidget from '$lib/components/molecules/RecentActivityWidget.svelte';
	import JobExecutionTrendsWidget from '$lib/components/molecules/JobExecutionTrendsWidget.svelte';
	import {
		fetchSystemStatus,
		fetchJobMetrics,
		fetchRecentActivity,
		fetchJobTrends
	} from '$lib/api/dashboard';
	import type {
		SystemStatus,
		JobExecutionMetrics,
		RecentActivity,
		JobTrendsData
	} from '$lib/types';

	// Dashboard data state
	let systemStatus: SystemStatus | undefined = undefined;
	let jobMetrics: JobExecutionMetrics | undefined = undefined;
	let recentActivity: RecentActivity | undefined = undefined;
	let trendsData: JobTrendsData | undefined = undefined;

	// Loading states for each widget
	let systemStatusLoading = true;
	let jobMetricsLoading = true;
	let recentActivityLoading = true;
	let trendsLoading = true;

	// Error states for each widget
	let systemStatusError: string | null = null;
	let jobMetricsError: string | null = null;
	let recentActivityError: string | null = null;
	let trendsError: string | null = null;

	// Refresh interval
	let refreshInterval: number | null = null;
	const REFRESH_INTERVAL = 30000; // 30 seconds

	// Current trends time range
	let currentTrendsRange: '1h' | '24h' | '7d' | '30d' = '24h';

	/**
	 * Load system status data
	 */
	async function loadSystemStatus() {
		systemStatusLoading = true;
		systemStatusError = null;

		try {
			const response = await fetchSystemStatus();
			if (response.success && response.data) {
				systemStatus = response.data;
			} else {
				systemStatusError = response.error?.message || 'Failed to load system status';
			}
		} catch (error) {
			systemStatusError = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			systemStatusLoading = false;
		}
	}

	/**
	 * Load job execution metrics
	 */
	async function loadJobMetrics() {
		jobMetricsLoading = true;
		jobMetricsError = null;

		try {
			const response = await fetchJobMetrics();
			if (response.success && response.data) {
				jobMetrics = response.data;
			} else {
				jobMetricsError = response.error?.message || 'Failed to load job metrics';
			}
		} catch (error) {
			jobMetricsError = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			jobMetricsLoading = false;
		}
	}

	/**
	 * Load recent activity data
	 */
	async function loadRecentActivity() {
		recentActivityLoading = true;
		recentActivityError = null;

		try {
			const response = await fetchRecentActivity();
			if (response.success && response.data) {
				recentActivity = response.data;
			} else {
				recentActivityError = response.error?.message || 'Failed to load recent activity';
			}
		} catch (error) {
			recentActivityError = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			recentActivityLoading = false;
		}
	}

	/**
	 * Load job trends data
	 */
	async function loadTrendsData(range: '1h' | '24h' | '7d' | '30d' = currentTrendsRange) {
		trendsLoading = true;
		trendsError = null;

		try {
			const response = await fetchJobTrends(range);
			if (response.success && response.data) {
				trendsData = response.data;
				currentTrendsRange = range;
			} else {
				trendsError = response.error?.message || 'Failed to load trends data';
			}
		} catch (error) {
			trendsError = error instanceof Error ? error.message : 'Unknown error occurred';
		} finally {
			trendsLoading = false;
		}
	}

	/**
	 * Load all dashboard data
	 */
	async function loadDashboardData() {
		await Promise.all([
			loadSystemStatus(),
			loadJobMetrics(),
			loadRecentActivity(),
			loadTrendsData()
		]);
	}

	/**
	 * Handle time range change for trends widget
	 */
	function handleTimeRangeChange(range: '1h' | '24h' | '7d' | '30d') {
		loadTrendsData(range);
	}

	/**
	 * Setup automatic refresh
	 */
	function setupRefresh() {
		refreshInterval = setInterval(() => {
			loadDashboardData();
		}, REFRESH_INTERVAL);
	}

	/**
	 * Cleanup refresh interval
	 */
	function cleanupRefresh() {
		if (refreshInterval) {
			clearInterval(refreshInterval);
			refreshInterval = null;
		}
	}

	// Lifecycle hooks
	onMount(() => {
		loadDashboardData();
		setupRefresh();
	});

	onDestroy(() => {
		cleanupRefresh();
	});
</script>

<svelte:head>
	<title>Dashboard - Strøm</title>
	<meta name="description" content="Strøm orchestration platform dashboard with real-time metrics and insights" />
</svelte:head>

<div class="min-h-screen bg-gray-50 dark:bg-gray-900">
	<!-- Dashboard Header -->
	<div class="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
		<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
						Monitor your workflow orchestration platform
					</p>
				</div>
				<div class="flex items-center space-x-3">
					<div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
						<div class="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
						Auto-refresh: 30s
					</div>
					<button
						type="button"
						class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
						on:click={loadDashboardData}
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
						</svg>
						Refresh
					</button>
				</div>
			</div>
		</div>
	</div>

	<!-- Dashboard Content -->
	<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
		<!-- Top Row: System Status and Job Metrics -->
		<div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
			<!-- System Status Widget -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
				<SystemStatusWidget
					{systemStatus}
					loading={systemStatusLoading}
					error={systemStatusError}
					onRetry={loadSystemStatus}
				/>
			</div>

			<!-- Job Execution Metrics Widget -->
			<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
				<JobExecutionMetricsWidget
					metrics={jobMetrics}
					loading={jobMetricsLoading}
					error={jobMetricsError}
					onRetry={loadJobMetrics}
				/>
			</div>
		</div>

		<!-- Bottom Row: Recent Activity and Trends -->
		<div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
			<!-- Recent Activity Widget (takes 1 column) -->
			<div class="xl:col-span-1">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">
					<RecentActivityWidget
						{recentActivity}
						loading={recentActivityLoading}
						error={recentActivityError}
						onRetry={loadRecentActivity}
					/>
				</div>
			</div>

			<!-- Job Execution Trends Widget (takes 2 columns) -->
			<div class="xl:col-span-2">
				<div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 h-full">
					<JobExecutionTrendsWidget
						{trendsData}
						loading={trendsLoading}
						error={trendsError}
						onRetry={() => loadTrendsData()}
						onTimeRangeChange={handleTimeRangeChange}
					/>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	/* Responsive adjustments for mobile */
	@media (max-width: 640px) {
		.max-w-7xl {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}

	/* Tablet adjustments */
	@media (min-width: 641px) and (max-width: 1024px) {
		.grid {
			gap: 1.5rem;
		}
	}

	/* Ensure consistent widget heights on larger screens */
	@media (min-width: 1280px) {
		.xl\:col-span-1,
		.xl\:col-span-2 {
			display: flex;
			flex-direction: column;
		}
		
		.xl\:col-span-1 > div,
		.xl\:col-span-2 > div {
			flex: 1;
		}
	}
</style>