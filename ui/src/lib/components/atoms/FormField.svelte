<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
		label?: string;
		helperText?: string;
		error?: string;
		required?: boolean;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	}

	let {
		label,
		helperText,
		error,
		required = false,
		disabled = false,
		class: className = '',
		children,
		...restProps
	}: FormFieldProps = $props();

	// Generate unique IDs for accessibility
	const fieldId = `field-${Math.random().toString(36).substr(2, 9)}`;
	const helperTextId = helperText ? `${fieldId}-helper` : undefined;
	const errorId = error ? `${fieldId}-error` : undefined;

	// Base field classes
	const baseClasses = [
		'space-y-1'
	];

	// Disabled state classes
	const disabledClasses = disabled ? ['opacity-50', 'pointer-events-none'] : [];

	// Combine all classes
	const fieldClasses = [
		...baseClasses,
		...disabledClasses,
		className
	].join(' ');

	// Label classes
	const labelClasses = [
		'block',
		'text-sm',
		'font-medium',
		'text-gray-700',
		'dark:text-gray-300'
	].join(' ');

	// Helper text classes
	const helperTextClasses = [
		'text-sm',
		'text-gray-500',
		'dark:text-gray-400'
	].join(' ');

	// Error text classes
	const errorTextClasses = [
		'text-sm',
		'text-error-600',
		'dark:text-error-400'
	].join(' ');
</script>

<div class={fieldClasses} {...restProps}>
	{#if label}
		<label for={fieldId} class={labelClasses}>
			{label}
			{#if required}
				<span class="text-error-500 ml-1" aria-label="required">*</span>
			{/if}
		</label>
	{/if}
	
	<div class="relative">
		{@render children?.()}
	</div>
	
	{#if helperText && !error}
		<p id={helperTextId} class={helperTextClasses}>
			{helperText}
		</p>
	{/if}
	
	{#if error}
		<p id={errorId} class={errorTextClasses} role="alert">
			{error}
		</p>
	{/if}
</div>