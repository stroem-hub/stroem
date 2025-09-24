<script lang="ts">
	import { Card } from '$lib/components';
	import { ExclamationTriangleIcon, InformationCircleIcon } from '$lib/components/icons';

	interface Props {
		title?: string;
		message?: string;
		variant?: 'warning' | 'info';
		class?: string;
	}

	let { 
		title = 'Statistics Unavailable',
		message = 'Unable to load execution statistics at this time.',
		variant = 'warning',
		class: className = ''
	}: Props = $props();

	let iconComponent = $derived(variant === 'warning' ? ExclamationTriangleIcon : InformationCircleIcon);
	let colorClasses = $derived(
		variant === 'warning' 
			? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
			: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
	);
	let textColorClasses = $derived(
		variant === 'warning'
			? 'text-yellow-900 dark:text-yellow-300'
			: 'text-blue-900 dark:text-blue-300'
	);
	let iconColorClasses = $derived(
		variant === 'warning'
			? 'text-yellow-600 dark:text-yellow-400'
			: 'text-blue-600 dark:text-blue-400'
	);
</script>

<Card class="max-w-none {colorClasses} {className}">
	{#snippet children()}
		<div class="flex items-start space-x-3">
			<div class="flex-shrink-0">
				{#if iconComponent === ExclamationTriangleIcon}
					<ExclamationTriangleIcon class="w-6 h-6 {iconColorClasses}" />
				{:else}
					<InformationCircleIcon class="w-6 h-6 {iconColorClasses}" />
				{/if}
			</div>
			<div class="flex-1">
				<h3 class="text-lg font-semibold {textColorClasses}">{title}</h3>
				<p class="mt-1 {variant === 'warning' ? 'text-yellow-700 dark:text-yellow-400' : 'text-blue-700 dark:text-blue-400'}">
					{message}
				</p>
			</div>
		</div>
	{/snippet}
</Card>