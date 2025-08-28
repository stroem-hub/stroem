<script lang="ts">
	import { theme } from '$lib/stores';

	interface Props {
		size?: 'sm' | 'md' | 'lg';
		showLabel?: boolean;
	}

	let { size = 'md', showLabel = false }: Props = $props();
	
	let currentTheme = $state('light');

	$effect(() => {
		theme.subscribe(value => {
			currentTheme = value;
		});
	});

	const sizeClasses = {
		sm: 'w-8 h-8',
		md: 'w-10 h-10',
		lg: 'w-12 h-12'
	};

	const iconSizeClasses = {
		sm: 'w-4 h-4',
		md: 'w-5 h-5',
		lg: 'w-6 h-6'
	};
</script>

<button
	class="inline-flex items-center justify-center {sizeClasses[size]} rounded-lg
		bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700
		text-gray-700 dark:text-gray-300 transition-colors duration-200
		focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2
		dark:focus:ring-offset-gray-900"
	onclick={() => theme.toggle()}
	aria-label={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
	title={currentTheme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
>
	{#if currentTheme === 'light'}
		<!-- Moon icon for dark mode -->
		<svg class={iconSizeClasses[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
				d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
		</svg>
	{:else}
		<!-- Sun icon for light mode -->
		<svg class={iconSizeClasses[size]} fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
				d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
		</svg>
	{/if}
	
	{#if showLabel}
		<span class="ml-2 text-sm font-medium">
			{currentTheme === 'light' ? 'Dark' : 'Light'}
		</span>
	{/if}
</button>