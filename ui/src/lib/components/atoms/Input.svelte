<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';

	interface InputProps extends Omit<HTMLInputAttributes, 'class'> {
		variant?: 'default' | 'error' | 'success';
		size?: 'sm' | 'md' | 'lg';
		fullWidth?: boolean;
		error?: string;
		success?: string;
		class?: string;
	}

	let {
		variant = 'default',
		size = 'md',
		fullWidth = false,
		disabled = false,
		error,
		success,
		class: className = '',
		...restProps
	}: InputProps = $props();

	// Determine the actual variant based on error/success states
	const actualVariant = error ? 'error' : success ? 'success' : variant;

	// Base input classes
	const baseClasses = [
		'border',
		'rounded-md',
		'transition-colors',
		'duration-200',
		'focus:outline-none',
		'focus:ring-2',
		'focus:ring-offset-2',
		'disabled:opacity-50',
		'disabled:cursor-not-allowed',
		'disabled:bg-gray-50',
		'dark:disabled:bg-gray-800',
		'placeholder:text-gray-400',
		'dark:placeholder:text-gray-500'
	];

	// Size classes
	const sizeClasses = {
		sm: ['px-3', 'py-1.5', 'text-sm'],
		md: ['px-3', 'py-2', 'text-sm'],
		lg: ['px-4', 'py-3', 'text-base']
	};

	// Variant classes
	const variantClasses = {
		default: [
			'border-gray-300',
			'dark:border-gray-600',
			'bg-white',
			'dark:bg-gray-900',
			'text-gray-900',
			'dark:text-gray-100',
			'focus:border-primary-500',
			'focus:ring-primary-500',
			'hover:border-gray-400',
			'dark:hover:border-gray-500'
		],
		error: [
			'border-error-300',
			'dark:border-error-600',
			'bg-white',
			'dark:bg-gray-900',
			'text-gray-900',
			'dark:text-gray-100',
			'focus:border-error-500',
			'focus:ring-error-500',
			'hover:border-error-400',
			'dark:hover:border-error-500'
		],
		success: [
			'border-success-300',
			'dark:border-success-600',
			'bg-white',
			'dark:bg-gray-900',
			'text-gray-900',
			'dark:text-gray-100',
			'focus:border-success-500',
			'focus:ring-success-500',
			'hover:border-success-400',
			'dark:hover:border-success-500'
		]
	};

	// Width classes
	const widthClasses = fullWidth ? ['w-full'] : [];

	// Combine all classes
	const inputClasses = [
		...baseClasses,
		...sizeClasses[size],
		...variantClasses[actualVariant],
		...widthClasses,
		className
	].join(' ');
</script>

<div class={fullWidth ? 'w-full' : ''}>
	<input class={inputClasses} {disabled} {...restProps} />
	
	{#if error}
		<p class="mt-1 text-sm text-error-600 dark:text-error-400" role="alert">
			{error}
		</p>
	{/if}
	
	{#if success && !error}
		<p class="mt-1 text-sm text-success-600 dark:text-success-400">
			{success}
		</p>
	{/if}
</div>