<script lang="ts">
	import type { HTMLSelectAttributes } from 'svelte/elements';

	interface SelectOption {
		value: string | number;
		label: string;
		disabled?: boolean;
	}

	interface SelectProps extends Omit<HTMLSelectAttributes, 'class'> {
		options: SelectOption[];
		variant?: 'default' | 'error' | 'success';
		size?: 'sm' | 'md' | 'lg';
		fullWidth?: boolean;
		error?: string;
		success?: string;
		placeholder?: string;
		searchable?: boolean;
		multiple?: boolean;
		class?: string;
	}

	let {
		options = [],
		variant = 'default',
		size = 'md',
		fullWidth = false,
		disabled = false,
		error,
		success,
		placeholder,
		searchable = false,
		multiple = false,
		class: className = '',
		...restProps
	}: SelectProps = $props();

	// Determine the actual variant based on error/success states
	const actualVariant = error ? 'error' : success ? 'success' : variant;

	// Base select classes
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
		'appearance-none',
		'bg-no-repeat',
		'bg-right',
		'pr-10'
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
	const selectClasses = [
		...baseClasses,
		...sizeClasses[size],
		...variantClasses[actualVariant],
		...widthClasses,
		className
	].join(' ');

	// Chevron down icon for the select dropdown
	const chevronIcon = `
		<svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
			<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
		</svg>
	`;
</script>

<div class={fullWidth ? 'w-full' : ''}>
	<div class="relative">
		<select 
			class={selectClasses} 
			{disabled} 
			{multiple}
			{...restProps}
		>
			{#if placeholder && !multiple}
				<option value="" disabled selected>{placeholder}</option>
			{/if}
			
			{#each options as option}
				<option 
					value={option.value} 
					disabled={option.disabled}
				>
					{option.label}
				</option>
			{/each}
		</select>
		
		<!-- Dropdown arrow -->
		{#if !multiple}
			<div class="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
				<svg class="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
				</svg>
			</div>
		{/if}
	</div>
	
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