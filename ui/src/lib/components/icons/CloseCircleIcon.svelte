<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface CloseCircleIconProps extends HTMLAttributes<SVGElement> {
		size?: number | string;
		class?: string;
	}

	let { size = 24, class: className = '', ...restProps }: CloseCircleIconProps = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="currentColor"
	class={className}
	{...restProps}
>
	<path
		fill-rule="evenodd"
		d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"
		clip-rule="evenodd"
	/>
	<path
		fill-rule="evenodd"
		d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM8.29 16.71L7 15.41 10.59 12 7 8.59 8.29 7.29 12 10.59l3.71-3.3L17 8.59 13.41 12 17 15.41l-1.29 1.3L12 13.41l-3.71 3.3z"
		clip-rule="evenodd"
	/>
</svg>