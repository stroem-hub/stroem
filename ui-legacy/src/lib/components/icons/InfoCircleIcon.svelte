<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';

	interface InfoCircleIconProps extends HTMLAttributes<SVGElement> {
		size?: number | string;
		class?: string;
	}

	let { size = 24, class: className = '', ...restProps }: InfoCircleIconProps = $props();
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
		d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
		clip-rule="evenodd"
	/>
</svg>