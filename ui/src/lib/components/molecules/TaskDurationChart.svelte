<script lang="ts">
	import type { JobExecutionPoint } from '$lib/types';

	interface Props {
		jobHistory: JobExecutionPoint[];
		height?: number;
		showLegend?: boolean;
		loading?: boolean;
		error?: string | Error | null;
		onRetry?: () => void;
	}

	let {
		jobHistory = [],
		height = 300,
		showLegend = true,
		loading = false,
		error = null,
		onRetry
	}: Props = $props();

	// Chart dimensions and margins
	const margin = { top: 20, right: 20, bottom: 40, left: 60 };
	let chartWidth = 800 - margin.left - margin.right;
	let chartHeight = height - margin.top - margin.bottom;

	// Process data for chart
	function processChartData() {
		if (!jobHistory || jobHistory.length === 0) return [];
		
		return jobHistory
			.filter(job => job.duration !== undefined && job.duration !== null)
			.map(job => ({
				...job,
				x: new Date(job.timestamp).getTime(),
				y: job.duration,
				color: job.status === 'success' ? '#10b981' : job.status === 'failed' ? '#ef4444' : '#f59e0b'
			}))
			.sort((a, b) => a.x - b.x);
	}

	// Calculate scales
	function calculateXScale(data: any[]) {
		if (data.length === 0) return { min: 0, max: 1, range: 1 };
		const xValues = data.map(d => d.x);
		const min = Math.min(...xValues);
		const max = Math.max(...xValues);
		const range = max - min || 1;
		return { min, max, range };
	}

	function calculateYScale(data: any[]) {
		if (data.length === 0) return { min: 0, max: 1, range: 1 };
		const yValues = data.map(d => d.y);
		const min = 0; // Always start from 0 for duration
		const max = Math.max(...yValues) * 1.1; // Add 10% padding
		const range = max - min || 1;
		return { min, max, range };
	}

	// Convert data values to SVG coordinates
	function getX(timestamp: number, xScale: any): number {
		return ((timestamp - xScale.min) / xScale.range) * chartWidth;
	}

	function getY(duration: number, yScale: any): number {
		return chartHeight - ((duration - yScale.min) / yScale.range) * chartHeight;
	}

	// Format duration for display
	function formatDuration(seconds: number): string {
		if (seconds < 60) {
			return `${seconds.toFixed(1)}s`;
		} else if (seconds < 3600) {
			const minutes = Math.floor(seconds / 60);
			const remainingSeconds = seconds % 60;
			return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
		} else {
			const hours = Math.floor(seconds / 3600);
			const minutes = Math.floor((seconds % 3600) / 60);
			return `${hours}h ${minutes}m`;
		}
	}

	// Format timestamp for display
	function formatTimestamp(timestamp: string): string {
		return new Date(timestamp).toLocaleString();
	}

	// Generate Y-axis ticks
	function generateYTicks(yScale: any) {
		const tickCount = 5;
		const ticks = [];
		for (let i = 0; i <= tickCount; i++) {
			const value = (yScale.max / tickCount) * i;
			ticks.push({
				value,
				y: getY(value, yScale),
				label: formatDuration(value)
			});
		}
		return ticks;
	}

	// Generate X-axis ticks
	function generateXTicks(data: any[], xScale: any) {
		if (data.length === 0) return [];
		
		const tickCount = Math.min(5, data.length);
		const ticks = [];
		
		for (let i = 0; i < tickCount; i++) {
			const index = Math.floor((data.length - 1) * (i / (tickCount - 1)));
			const dataPoint = data[index];
			if (dataPoint) {
				ticks.push({
					value: dataPoint.x,
					x: getX(dataPoint.x, xScale),
					label: new Date(dataPoint.x).toLocaleDateString()
				});
			}
		}
		
		return ticks;
	}

	// Tooltip state
	let hoveredPoint: any = $state(null);
	let tooltipX = $state(0);
	let tooltipY = $state(0);

	function handlePointHover(point: any, event: MouseEvent) {
		hoveredPoint = point;
		tooltipX = event.clientX;
		tooltipY = event.clientY;
	}

	function handlePointLeave() {
		hoveredPoint = null;
	}

	// Reactive calculations
	let chartData = $derived(processChartData());
	let xScale = $derived(calculateXScale(chartData));
	let yScale = $derived(calculateYScale(chartData));
	let yTicks = $derived(generateYTicks(yScale));
	let xTicks = $derived(generateXTicks(chartData, xScale));
</script>

<div class="w-full">
	{#if loading}
		<div class="flex items-center justify-center" style="height: {height}px;">
			<div class="animate-spin w-8 h-8 border-4 border-gray-300 border-t-primary-500 rounded-full"></div>
			<span class="ml-3 text-gray-600 dark:text-gray-400">Loading chart data...</span>
		</div>
	{:else if error}
		<div class="flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6" style="height: {height}px;">
			<h3 class="text-lg font-semibold text-red-900 dark:text-red-300 mb-2">Chart Error</h3>
			<p class="text-red-700 dark:text-red-400 text-center mb-4">
				{typeof error === 'string' ? error : error?.message || 'Failed to load chart data'}
			</p>
			{#if onRetry}
				<button
					onclick={onRetry}
					class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
				>
					Retry
				</button>
			{/if}
		</div>
	{:else if chartData.length === 0}
		<div class="flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6" style="height: {height}px;">
			<svg class="w-12 h-12 text-gray-400 dark:text-gray-500 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path>
			</svg>
			<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Chart Data</h3>
			<p class="text-gray-600 dark:text-gray-400 text-center">
				No job execution data available to display in the chart.
			</p>
		</div>
	{:else}
		<div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
			<!-- Chart Title -->
			<div class="mb-4">
				<h3 class="text-lg font-semibold text-gray-900 dark:text-white">Job Duration Over Time</h3>
				<p class="text-sm text-gray-600 dark:text-gray-400">
					Execution duration for the last {chartData.length} jobs
				</p>
			</div>

			<!-- Legend -->
			{#if showLegend}
				<div class="flex items-center gap-6 mb-4 text-sm">
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full bg-green-500"></div>
						<span class="text-gray-700 dark:text-gray-300">Successful</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full bg-red-500"></div>
						<span class="text-gray-700 dark:text-gray-300">Failed</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="w-3 h-3 rounded-full bg-yellow-500"></div>
						<span class="text-gray-700 dark:text-gray-300">Running</span>
					</div>
				</div>
			{/if}

			<!-- Chart SVG -->
			<div class="overflow-x-auto">
				<svg 
					width={800} 
					height={height}
					class="border border-gray-200 dark:border-gray-700 rounded"
				>
					<!-- Chart background -->
					<rect 
						x={margin.left} 
						y={margin.top} 
						width={chartWidth} 
						height={chartHeight}
						fill="transparent"
						stroke="none"
					/>

					<!-- Grid lines -->
					<g class="opacity-20">
						<!-- Horizontal grid lines -->
						{#each yTicks as tick}
							<line
								x1={margin.left}
								y1={margin.top + tick.y}
								x2={margin.left + chartWidth}
								y2={margin.top + tick.y}
								stroke="currentColor"
								stroke-width="1"
								class="text-gray-400 dark:text-gray-600"
							/>
						{/each}
						
						<!-- Vertical grid lines -->
						{#each xTicks as tick}
							<line
								x1={margin.left + tick.x}
								y1={margin.top}
								x2={margin.left + tick.x}
								y2={margin.top + chartHeight}
								stroke="currentColor"
								stroke-width="1"
								class="text-gray-400 dark:text-gray-600"
							/>
						{/each}
					</g>

					<!-- Y-axis -->
					<g>
						<line
							x1={margin.left}
							y1={margin.top}
							x2={margin.left}
							y2={margin.top + chartHeight}
							stroke="currentColor"
							stroke-width="2"
							class="text-gray-600 dark:text-gray-400"
						/>
						
						<!-- Y-axis labels -->
						{#each yTicks as tick}
							<text
								x={margin.left - 10}
								y={margin.top + tick.y + 4}
								text-anchor="end"
								class="text-xs fill-gray-600 dark:fill-gray-400"
							>
								{tick.label}
							</text>
						{/each}
						
						<!-- Y-axis title -->
						<text
							x={20}
							y={margin.top + chartHeight / 2}
							text-anchor="middle"
							transform="rotate(-90, 20, {margin.top + chartHeight / 2})"
							class="text-sm fill-gray-700 dark:fill-gray-300 font-medium"
						>
							Duration
						</text>
					</g>

					<!-- X-axis -->
					<g>
						<line
							x1={margin.left}
							y1={margin.top + chartHeight}
							x2={margin.left + chartWidth}
							y2={margin.top + chartHeight}
							stroke="currentColor"
							stroke-width="2"
							class="text-gray-600 dark:text-gray-400"
						/>
						
						<!-- X-axis labels -->
						{#each xTicks as tick}
							<text
								x={margin.left + tick.x}
								y={margin.top + chartHeight + 20}
								text-anchor="middle"
								class="text-xs fill-gray-600 dark:fill-gray-400"
							>
								{tick.label}
							</text>
						{/each}
						
						<!-- X-axis title -->
						<text
							x={margin.left + chartWidth / 2}
							y={height - 5}
							text-anchor="middle"
							class="text-sm fill-gray-700 dark:fill-gray-300 font-medium"
						>
							Time
						</text>
					</g>

					<!-- Data points -->
					<g>
						{#each chartData as point}
							<circle
								cx={margin.left + getX(point.x, xScale)}
								cy={margin.top + getY(point.y, yScale)}
								r="4"
								fill={point.color}
								stroke="white"
								stroke-width="2"
								class="cursor-pointer hover:r-6 transition-all duration-200"
								role="button"
								tabindex="0"
								aria-label="Job {point.jobId}: {formatDuration(point.y)} - {point.status}"
								onmouseenter={(e) => handlePointHover(point, e)}
								onmouseleave={handlePointLeave}
								onkeydown={(e) => e.key === 'Enter' && handlePointHover(point, { clientX: tooltipX, clientY: tooltipY } as MouseEvent)}
							/>
						{/each}
					</g>
				</svg>
			</div>

			<!-- Custom Tooltip -->
			{#if hoveredPoint}
				<div 
					class="fixed z-50 bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg pointer-events-none"
					style="left: {tooltipX + 10}px; top: {tooltipY - 10}px;"
				>
					<div class="font-semibold">Job: {hoveredPoint.jobId}</div>
					<div>Duration: {formatDuration(hoveredPoint.y)}</div>
					<div>Status: <span class="capitalize">{hoveredPoint.status}</span></div>
					<div>Time: {formatTimestamp(hoveredPoint.timestamp)}</div>
					{#if hoveredPoint.triggeredBy}
						<div>Triggered by: {hoveredPoint.triggeredBy}</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>