<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface TooltipProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
		text: string;
		placement?: 'top' | 'bottom' | 'left' | 'right';
		class?: string;
		children: Snippet;
	}

	let {
		text,
		placement = 'top',
		class: className = '',
		children,
		...restProps
	}: TooltipProps = $props();

	// Placement classes
	const placementClasses = {
		top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
		bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
		left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
		right: 'left-full top-1/2 transform -translate-y-1/2 ml-2'
	};

	// Arrow classes
	const arrowClasses = {
		top: 'top-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-gray-900',
		bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-gray-900',
		left: 'left-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-gray-900',
		right: 'right-full top-1/2 transform -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-gray-900'
	};
</script>

<div class="relative inline-block group {className}" {...restProps}>
	{@render children()}
	
	<!-- Tooltip -->
	<div class="absolute {placementClasses[placement]} px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 pointer-events-none">
		{text}
		<!-- Arrow -->
		<div class="absolute w-0 h-0 border-4 {arrowClasses[placement]}"></div>
	</div>
</div>