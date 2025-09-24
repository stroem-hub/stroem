<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLLabelAttributes } from 'svelte/elements';

	interface LabelProps extends Omit<HTMLLabelAttributes, 'class'> {
		required?: boolean;
		children: Snippet;
		class?: string;
	}

	let {
		required = false,
		children,
		class: className = '',
		...restProps
	}: LabelProps = $props();

	// Base label classes
	const baseClasses = [
		'block',
		'text-sm',
		'font-medium',
		'text-gray-700',
		'dark:text-gray-300',
		'mb-1'
	];

	// Combine all classes
	const labelClasses = [
		...baseClasses,
		className
	].join(' ');
</script>

<label
	class={labelClasses}
	{...restProps}
>
	{@render children()}
	{#if required}
		<span 
			class="text-red-500 ml-1" 
			aria-label="Required field"
			title="This field is required"
		>
			*
		</span>
	{/if}
</label>