<script lang="ts">
	import type { JobExecutionTrendsWidgetProps, JobTrendsData } from '$lib/types';
	import { 
		ErrorBoundary, 
		Button
	} from '$lib/components';
	import { 
		ArrowPathIcon,
		ExclamationTriangleIcon,
		ChartBarIcon
	} from '$lib/components/icons';
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';

	let {
		trendsData,
		loading = false,
		error = null,
		onRetry,
		onTimeRangeChange
	}: JobExecutionTrendsWidgetProps = $props();

	// Chart.js setup
	Chart.register(...registerables);

	let chartCanvas: HTMLCanvasElement;
	let chartInstance: Chart | null = null;
	let selectedTimeRange: '1h' | '24h' | '7d' | '30d' = $state('24h');

	// Time range options
	const timeRangeOptions = [
		{ value: '1h' as const, label: '1 Hour' },
		{ value: '24h' as const, label: '24 Hours' },
		{ value: '7d' as const, label: '7 Days' },
		{ value: '30d' as const, label: '30 Days' }
	];

	// Handle time range change
	function handleTimeRangeChange(range: '1h' | '24h' | '7d' | '30d') {
		selectedTimeRange = range;
		onTimeRangeChange?.(range);
	}

	// Format timestamp for chart labels
	function formatTimestamp(timestamp: string, timeRange: string): string {
		const date = new Date(timestamp);
		
		switch (timeRange) {
			case '1h':
				return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			case '24h':
				return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
			case '7d':
				return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
			case '30d':
				return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
			default:
				return date.toLocaleDateString();
		}
	}

	// Create chart configuration
	function createChartConfig(data: JobTrendsData) {
		const labels = data.time_series.map(point => 
			formatTimestamp(point.timestamp, data.time_range)
		);

		const totalJobs = data.time_series.map(point => point.total_jobs);
		const successfulJobs = data.time_series.map(point => point.successful_jobs);
		const failedJobs = data.time_series.map(point => point.failed_jobs);

		return {
			type: 'line' as const,
			data: {
				labels,
				datasets: [
					{
						label: 'Total Jobs',
						data: totalJobs,
						borderColor: 'rgb(59, 130, 246)',
						backgroundColor: 'rgba(59, 130, 246, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.1,
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: 'rgb(59, 130, 246)',
						pointBorderColor: '#ffffff',
						pointBorderWidth: 2
					},
					{
						label: 'Successful Jobs',
						data: successfulJobs,
						borderColor: 'rgb(16, 185, 129)',
						backgroundColor: 'rgba(16, 185, 129, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.1,
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: 'rgb(16, 185, 129)',
						pointBorderColor: '#ffffff',
						pointBorderWidth: 2
					},
					{
						label: 'Failed Jobs',
						data: failedJobs,
						borderColor: 'rgb(239, 68, 68)',
						backgroundColor: 'rgba(239, 68, 68, 0.1)',
						borderWidth: 2,
						fill: false,
						tension: 0.1,
						pointRadius: 4,
						pointHoverRadius: 6,
						pointBackgroundColor: 'rgb(239, 68, 68)',
						pointBorderColor: '#ffffff',
						pointBorderWidth: 2
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				interaction: {
					mode: 'index' as const,
					intersect: false
				},
				plugins: {
					legend: {
						display: true,
						position: 'top' as const,
						labels: {
							usePointStyle: true,
							padding: 20,
							color: document.documentElement.classList.contains('dark') ? '#e5e7eb' : '#374151'
						}
					},
					tooltip: {
						backgroundColor: 'rgba(17, 24, 39, 0.95)',
						titleColor: '#f9fafb',
						bodyColor: '#f9fafb',
						borderColor: '#374151',
						borderWidth: 1,
						cornerRadius: 8,
						displayColors: true,
						callbacks: {
							title: function(context: any) {
								const index = context[0].dataIndex;
								const timestamp = data.time_series[index].timestamp;
								return new Date(timestamp).toLocaleString();
							},
							afterBody: function(context: any) {
								const index = context[0].dataIndex;
								const point = data.time_series[index];
								const successRate = point.total_jobs > 0 
									? ((point.successful_jobs / point.total_jobs) * 100).toFixed(1)
									: '0';
								return [`Success Rate: ${successRate}%`];
							}
						}
					}
				},
				scales: {
					x: {
						display: true,
						title: {
							display: true,
							text: 'Time',
							color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280'
						},
						grid: {
							color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
						},
						ticks: {
							color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
							maxTicksLimit: 8
						}
					},
					y: {
						display: true,
						title: {
							display: true,
							text: 'Number of Jobs',
							color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280'
						},
						grid: {
							color: document.documentElement.classList.contains('dark') ? '#374151' : '#e5e7eb'
						},
						ticks: {
							color: document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280',
							beginAtZero: true,
							precision: 0
						}
					}
				},
				elements: {
					point: {
						hoverBorderWidth: 3
					}
				}
			}
		};
	}

	// Initialize or update chart
	function updateChart() {
		if (!chartCanvas || !trendsData) return;

		// Destroy existing chart
		if (chartInstance) {
			chartInstance.destroy();
			chartInstance = null;
		}

		// Create new chart
		const config = createChartConfig(trendsData);
		chartInstance = new Chart(chartCanvas, config);
	}

	// Update chart when data changes
	$effect(() => {
		if (trendsData && chartCanvas) {
			updateChart();
		}
	});

	// Update selected time range when trendsData changes
	$effect(() => {
		if (trendsData?.time_range) {
			selectedTimeRange = trendsData.time_range;
		}
	});

	// Cleanup on destroy
	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
		}
	});

	// Calculate summary statistics
	let summaryStats = $derived(() => {
		if (!trendsData || trendsData.time_series.length === 0) {
			return {
				totalJobs: 0,
				avgSuccessRate: 0,
				peakJobs: 0,
				trend: 'stable' as const
			};
		}

		const series = trendsData.time_series;
		const totalJobs = series.reduce((sum, point) => sum + point.total_jobs, 0);
		const totalSuccessful = series.reduce((sum, point) => sum + point.successful_jobs, 0);
		const avgSuccessRate = totalJobs > 0 ? (totalSuccessful / totalJobs) * 100 : 0;
		const peakJobs = Math.max(...series.map(point => point.total_jobs));

		// Calculate trend (compare first half vs second half)
		const midPoint = Math.floor(series.length / 2);
		const firstHalf = series.slice(0, midPoint);
		const secondHalf = series.slice(midPoint);
		
		const firstHalfAvg = firstHalf.length > 0 
			? firstHalf.reduce((sum, point) => sum + point.total_jobs, 0) / firstHalf.length 
			: 0;
		const secondHalfAvg = secondHalf.length > 0 
			? secondHalf.reduce((sum, point) => sum + point.total_jobs, 0) / secondHalf.length 
			: 0;

		let trend: 'up' | 'down' | 'stable' = 'stable';
		const trendThreshold = 0.1; // 10% change threshold
		
		if (secondHalfAvg > firstHalfAvg * (1 + trendThreshold)) {
			trend = 'up';
		} else if (secondHalfAvg < firstHalfAvg * (1 - trendThreshold)) {
			trend = 'down';
		}

		return {
			totalJobs,
			avgSuccessRate,
			peakJobs,
			trend
		};
	});
</script>

{#if loading}
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="animate-pulse">
			<!-- Header skeleton -->
			<div class="mb-6">
				<div class="h-6 w-48 bg-gray-200 rounded dark:bg-gray-700 mb-2"></div>
				<div class="h-4 w-64 bg-gray-200 rounded dark:bg-gray-700"></div>
			</div>
			
			<!-- Time range selector skeleton -->
			<div class="mb-6 flex gap-2">
				{#each Array(4) as _}
					<div class="h-8 w-16 bg-gray-200 rounded dark:bg-gray-700"></div>
				{/each}
			</div>
			
			<!-- Chart skeleton -->
			<div class="h-80 bg-gray-200 rounded dark:bg-gray-700 mb-4"></div>
			
			<!-- Stats skeleton -->
			<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
				{#each Array(4) as _}
					<div class="text-center">
						<div class="h-8 w-16 bg-gray-200 rounded mx-auto mb-2 dark:bg-gray-700"></div>
						<div class="h-4 w-20 bg-gray-200 rounded mx-auto dark:bg-gray-700"></div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{:else if error}
	<ErrorBoundary 
		{error}
		title="Failed to load job trends"
		description="Unable to load job execution trends data at this time."
		{onRetry}
	/>
{:else if !trendsData || trendsData.time_series.length === 0}
	<div class="rounded-lg border border-gray-200 bg-white p-8 text-center shadow-sm dark:border-gray-700 dark:bg-gray-800">
		<div class="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
			<ChartBarIcon class="h-6 w-6 text-gray-600 dark:text-gray-400" />
		</div>
		<h3 class="mt-4 text-lg font-semibold text-gray-900 dark:text-white">No Trends Data</h3>
		<p class="mt-2 text-sm text-gray-600 dark:text-gray-400">
			No job execution trends data is available for the selected time range.
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
	<div class="rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800" role="region" aria-label="Job Execution Trends">
		<!-- Header -->
		<div class="mb-6">
			<h2 class="text-xl font-semibold text-gray-900 dark:text-white">Job Execution Trends</h2>
			<p class="mt-1 text-sm text-gray-600 dark:text-gray-400">
				Historical job execution patterns and success rates over time
			</p>
		</div>

		<!-- Time Range Selector -->
		<div class="mb-6">
			<div class="flex flex-wrap gap-2" role="tablist" aria-label="Time range selection">
				{#each timeRangeOptions as option}
					<button
						type="button"
						role="tab"
						aria-selected={selectedTimeRange === option.value}
						aria-controls="trends-chart"
						class="px-3 py-1.5 text-sm font-medium rounded-md transition-colors duration-200
							{selectedTimeRange === option.value
								? 'bg-blue-600 text-white shadow-sm'
								: 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
							}"
						onclick={() => handleTimeRangeChange(option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Chart Container -->
		<div class="mb-6">
			<div class="relative h-80 w-full" id="trends-chart" role="img" aria-label="Job execution trends chart">
				<canvas 
					bind:this={chartCanvas}
					class="w-full h-full"
					aria-label="Interactive chart showing job execution trends over time"
				></canvas>
			</div>
		</div>

		<!-- Summary Statistics -->
		<div class="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
			<!-- Total Jobs -->
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{summaryStats().totalJobs.toLocaleString()}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Total Jobs</div>
			</div>

			<!-- Average Success Rate -->
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{summaryStats().avgSuccessRate.toFixed(1)}%
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Avg Success Rate</div>
			</div>

			<!-- Peak Jobs -->
			<div class="text-center">
				<div class="text-2xl font-bold text-gray-900 dark:text-white">
					{summaryStats().peakJobs.toLocaleString()}
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Peak Jobs</div>
			</div>

			<!-- Trend -->
			<div class="text-center">
				<div class="flex items-center justify-center gap-1">
					<span class="text-2xl font-bold text-gray-900 dark:text-white">
						{summaryStats().trend === 'up' ? '↗' : summaryStats().trend === 'down' ? '↘' : '→'}
					</span>
					<span class="text-2xl font-bold 
						{summaryStats().trend === 'up' ? 'text-green-600 dark:text-green-400' : 
						  summaryStats().trend === 'down' ? 'text-red-600 dark:text-red-400' : 
						  'text-gray-600 dark:text-gray-400'}">
						{summaryStats().trend === 'up' ? 'Rising' : summaryStats().trend === 'down' ? 'Falling' : 'Stable'}
					</span>
				</div>
				<div class="text-sm text-gray-600 dark:text-gray-400">Trend</div>
			</div>
		</div>
	</div>
{/if}