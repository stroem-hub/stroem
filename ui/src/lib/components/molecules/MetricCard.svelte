<script lang="ts">
	import type { Snippet } from 'svelte';

	interface MetricCardProps {
		title: string;
		value: string | number;
		change?: {
			value: number;
			type: 'increase' | 'decrease';
			period: string;
		};
		icon?: Snippet;
		color?: 'blue' | 'green' | 'yellow' | 'red';
		loading?: boolean;
	}

	let {
		title,
		value,
		change,
		icon,
		color = 'blue',
		loading = false
	}: MetricCardProps = $props();

	const colorClasses = {
		blue: {
			bg: 'bg-blue-50 dark:bg-blue-900/20',
			icon: 'text-blue-600 dark:text-blue-400',
			border: 'border-blue-200 dark:border-blue-800'
		},
		green: {
			bg: 'bg-green-50 dark:bg-green-900/20',
			icon: 'text-green-600 dark:text-green-400',
			border: 'border-green-200 dark:border-green-800'
		},
		yellow: {
			bg: 'bg-yellow-50 dark:bg-yellow-900/20',
			icon: 'text-yellow-600 dark:text-yellow-400',
			border: 'border-yellow-200 dark:border-yellow-800'
		},
		red: {
			bg: 'bg-red-50 dark:bg-red-900/20',
			icon: 'text-red-600 dark:text-red-400',
			border: 'border-red-200 dark:border-red-800'
		}
	};

	const currentColorClasses = colorClasses[color];
</script>

<div
	class="relative overflow-hidden rounded-lg border {currentColorClasses.border} {currentColorClasses.bg} p-6 shadow-sm transition-all duration-200 hover:shadow-md"
>
	{#if loading}
		<div class="animate-pulse">
			<div class="flex items-center justify-between">
				<div class="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700"></div>
				<div class="h-8 w-8 rounded bg-gray-200 dark:bg-gray-700"></div>
			</div>
			<div class="mt-4 h-8 w-32 rounded bg-gray-200 dark:bg-gray-700"></div>
			<div class="mt-2 h-4 w-20 rounded bg-gray-200 dark:bg-gray-700"></div>
		</div>
	{:else}
		<div class="flex items-center justify-between">
			<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</h3>
			{#if icon}
				<div class="flex h-8 w-8 items-center justify-center rounded-md {currentColorClasses.icon}">
					{@render icon()}
				</div>
			{/if}
		</div>

		<div class="mt-4">
			<p class="text-3xl font-bold text-gray-900 dark:text-white">
				{typeof value === 'number' ? value.toLocaleString() : value}
			</p>
			{#if change}
				<div class="mt-2 flex items-center text-sm">
					{#if change.type === 'increase'}
						<svg class="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
						<span class="ml-1 text-green-600 dark:text-green-400">
							+{Math.abs(change.value)}%
						</span>
					{:else}
						<svg class="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
							<path
								fill-rule="evenodd"
								d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z"
								clip-rule="evenodd"
							/>
						</svg>
						<span class="ml-1 text-red-600 dark:text-red-400">
							-{Math.abs(change.value)}%
						</span>
					{/if}
					<span class="ml-1 text-gray-500 dark:text-gray-400">from {change.period}</span>
				</div>
			{/if}
		</div>
	{/if}
</div>