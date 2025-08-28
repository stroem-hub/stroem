<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	interface ButtonProps extends Omit<HTMLButtonAttributes, 'class'> {
		variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
		size?: 'sm' | 'md' | 'lg';
		loading?: boolean;
		fullWidth?: boolean;
		children: Snippet;
		class?: string;
	}

	let {
		variant = 'primary',
		size = 'md',
		disabled = false,
		loading = false,
		fullWidth = false,
		children,
		class: className = '',
		...restProps
	}: ButtonProps = $props();

	// Base button classes
	const baseClasses = [
		'inline-flex',
		'items-center',
		'justify-center',
		'font-medium',
		'transition-colors',
		'focus:outline-none',
		'focus:ring-2',
		'focus:ring-offset-2',
		'disabled:opacity-50',
		'disabled:cursor-not-allowed',
		'disabled:pointer-events-none'
	];

	// Size variants
	const sizeClasses = {
		sm: ['px-3', 'py-1.5', 'text-sm', 'rounded-md', 'gap-1.5'],
		md: ['px-4', 'py-2', 'text-sm', 'rounded-md', 'gap-2'],
		lg: ['px-6', 'py-3', 'text-base', 'rounded-lg', 'gap-2.5']
	};

	// Variant classes
	const variantClasses = {
		primary: [
			'bg-primary-600',
			'text-white',
			'hover:bg-primary-700',
			'focus:ring-primary-500',
			'active:bg-primary-800'
		],
		secondary: [
			'bg-gray-100',
			'text-gray-900',
			'hover:bg-gray-200',
			'focus:ring-gray-500',
			'active:bg-gray-300',
			'dark:bg-gray-800',
			'dark:text-gray-100',
			'dark:hover:bg-gray-700',
			'dark:active:bg-gray-600'
		],
		outline: [
			'border',
			'border-gray-300',
			'bg-white',
			'text-gray-700',
			'hover:bg-gray-50',
			'focus:ring-primary-500',
			'active:bg-gray-100',
			'dark:border-gray-600',
			'dark:bg-gray-900',
			'dark:text-gray-300',
			'dark:hover:bg-gray-800',
			'dark:active:bg-gray-700'
		],
		ghost: [
			'text-gray-700',
			'hover:bg-gray-100',
			'focus:ring-gray-500',
			'active:bg-gray-200',
			'dark:text-gray-300',
			'dark:hover:bg-gray-800',
			'dark:active:bg-gray-700'
		],
		danger: [
			'bg-error-600',
			'text-white',
			'hover:bg-error-700',
			'focus:ring-error-500',
			'active:bg-error-800'
		]
	};

	// Width classes
	const widthClasses = fullWidth ? ['w-full'] : [];

	// Loading classes
	const loadingClasses = loading ? ['cursor-wait'] : [];

	// Combine all classes
	const buttonClasses = [
		...baseClasses,
		...sizeClasses[size],
		...variantClasses[variant],
		...widthClasses,
		...loadingClasses,
		className
	].join(' ');

	// Determine if button should be disabled
	const isDisabled = disabled || loading;
</script>

<button class={buttonClasses} disabled={isDisabled} {...restProps}>
	{#if loading}
		<svg
			class="animate-spin -ml-1 mr-2 h-4 w-4"
			xmlns="http://www.w3.org/2000/svg"
			fill="none"
			viewBox="0 0 24 24"
		>
			<circle
				class="opacity-25"
				cx="12"
				cy="12"
				r="10"
				stroke="currentColor"
				stroke-width="4"
			></circle>
			<path
				class="opacity-75"
				fill="currentColor"
				d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
			></path>
		</svg>
	{/if}
	{@render children?.()}
</button>