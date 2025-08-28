<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		CategoryScale,
		LinearScale,
		PointElement,
		LineElement,
		LineController,
		Title,
		Tooltip,
		Legend,
		type ChartConfiguration
	} from 'chart.js';

	// Register Chart.js components
	Chart.register(CategoryScale, LinearScale, PointElement, LineElement, LineController, Title, Tooltip, Legend);

	interface ChartDataPoint {
		[key: string]: string | number | Date;
	}

	interface LineChartProps {
		data: ChartDataPoint[];
		xAxis: string;
		yAxis: string;
		color?: string;
		height?: number;
		loading?: boolean;
		title?: string;
	}

	let {
		data = [],
		xAxis,
		yAxis,
		color = '#3b82f6',
		height = 300,
		loading = false,
		title
	}: LineChartProps = $props();

	let canvas: HTMLCanvasElement = $state()!;
	let chart: Chart | null = $state(null);

	function createChart() {
		if (!canvas || loading || data.length === 0) return;

		// Destroy existing chart
		if (chart) {
			chart.destroy();
		}

		const ctx = canvas.getContext('2d');
		if (!ctx) return;

		// Prepare chart data
		const labels = data.map((item) => {
			const value = item[xAxis];
			if (value instanceof Date) {
				return value.toLocaleDateString();
			}
			return String(value);
		});

		const values = data.map((item) => {
			const value = item[yAxis];
			return typeof value === 'number' ? value : 0;
		});

		const config: ChartConfiguration = {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: yAxis,
						data: values,
						borderColor: color,
						backgroundColor: color + '20',
						borderWidth: 2,
						fill: true,
						tension: 0.4,
						pointBackgroundColor: color,
						pointBorderColor: color,
						pointHoverBackgroundColor: color,
						pointHoverBorderColor: '#ffffff',
						pointRadius: 4,
						pointHoverRadius: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					title: {
						display: !!title,
						text: title,
						color: getComputedStyle(document.documentElement).getPropertyValue('--color-gray-900') || '#111827'
					},
					legend: {
						display: false
					},
					tooltip: {
						mode: 'index',
						intersect: false,
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						titleColor: '#ffffff',
						bodyColor: '#ffffff',
						borderColor: color,
						borderWidth: 1
					}
				},
				scales: {
					x: {
						display: true,
						grid: {
							color: 'rgba(0, 0, 0, 0.1)'
						},
						ticks: {
							color: getComputedStyle(document.documentElement).getPropertyValue('--color-gray-600') || '#6b7280'
						}
					},
					y: {
						display: true,
						grid: {
							color: 'rgba(0, 0, 0, 0.1)'
						},
						ticks: {
							color: getComputedStyle(document.documentElement).getPropertyValue('--color-gray-600') || '#6b7280'
						}
					}
				},
				interaction: {
					mode: 'nearest',
					axis: 'x',
					intersect: false
				}
			}
		};

		chart = new Chart(ctx, config);
	}

	onMount(() => {
		createChart();
	});

	onDestroy(() => {
		if (chart) {
			chart.destroy();
		}
	});

	// Recreate chart when data changes - use untrack to prevent loops
	$effect(() => {
		if (data && data.length > 0 && !loading && canvas) {
			createChart();
		}
	});
</script>

<div class="relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
	{#if loading}
		<div class="flex items-center justify-center" style="height: {height}px;">
			<div class="animate-pulse">
				<div class="mb-4 h-4 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
				<div class="space-y-2">
					{#each Array(6) as _}
						<div class="h-8 w-full rounded bg-gray-200 dark:bg-gray-700"></div>
					{/each}
				</div>
			</div>
		</div>
	{:else if data.length === 0}
		<div class="flex items-center justify-center" style="height: {height}px;">
			<div class="text-center">
				<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
				</svg>
				<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No data available</h3>
				<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Chart data will appear here when available.</p>
			</div>
		</div>
	{:else}
		<canvas bind:this={canvas} style="height: {height}px;"></canvas>
	{/if}
</div>