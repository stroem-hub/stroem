<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { CheckCircleIcon, ExclamationCircleIcon, XIcon } from '../icons';

	interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
		variant?: 'info' | 'success' | 'warning' | 'error';
		dismissible?: boolean;
		onclose?: () => void;
		children: Snippet;
		icon?: Snippet;
		class?: string;
	}

	let {
		variant = 'info',
		dismissible = false,
		onclose,
		children,
		icon,
		class: className = '',
		...restProps
	}: AlertProps = $props();

	// Base alert classes
	const baseClasses = [
		'flex',
		'items-start',
		'p-4',
		'rounded-lg',
		'border',
		'gap-3'
	];

	// Variant classes
	const variantClasses = {
		info: [
			'bg-blue-50',
			'border-blue-200',
			'text-blue-800',
			'dark:bg-blue-900/20',
			'dark:border-blue-800',
			'dark:text-blue-300'
		],
		success: [
			'bg-green-50',
			'border-green-200',
			'text-green-800',
			'dark:bg-green-900/20',
			'dark:border-green-800',
			'dark:text-green-300'
		],
		warning: [
			'bg-yellow-50',
			'border-yellow-200',
			'text-yellow-800',
			'dark:bg-yellow-900/20',
			'dark:border-yellow-800',
			'dark:text-yellow-300'
		],
		error: [
			'bg-red-50',
			'border-red-200',
			'text-red-800',
			'dark:bg-red-900/20',
			'dark:border-red-800',
			'dark:text-red-300'
		]
	};

	// Icon color classes for default icons
	const iconColorClasses = {
		info: 'text-blue-500 dark:text-blue-400',
		success: 'text-green-500 dark:text-green-400',
		warning: 'text-yellow-500 dark:text-yellow-400',
		error: 'text-red-500 dark:text-red-400'
	};

	// Combine all classes
	const alertClasses = [
		...baseClasses,
		...variantClasses[variant],
		className
	].join(' ');



	// Handle close action
	function handleClose() {
		onclose?.();
	}

	// Handle keyboard events for close button
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleClose();
		}
	}
</script>

<div
	class={alertClasses}
	role="alert"
	aria-live="polite"
	{...restProps}
>
	<!-- Icon -->
	<div class="flex-shrink-0">
		{#if icon}
			{@render icon()}
		{:else}
			{#if variant === 'info'}
				<ExclamationCircleIcon class="w-5 h-5 {iconColorClasses[variant]}" />
			{:else if variant === 'success'}
				<CheckCircleIcon class="w-5 h-5 {iconColorClasses[variant]}" />
			{:else if variant === 'warning'}
				<ExclamationCircleIcon class="w-5 h-5 {iconColorClasses[variant]}" />
			{:else if variant === 'error'}
				<ExclamationCircleIcon class="w-5 h-5 {iconColorClasses[variant]}" />
			{/if}
		{/if}
	</div>

	<!-- Content -->
	<div class="flex-1 min-w-0">
		{@render children()}
	</div>

	<!-- Close button -->
	{#if dismissible}
		<div class="flex-shrink-0">
			<button
				type="button"
				class="inline-flex rounded-md p-1.5 hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent focus:ring-current transition-colors dark:hover:bg-white/5"
				onclick={handleClose}
				onkeydown={handleKeydown}
				aria-label="Close alert"
			>
				<XIcon class="w-4 h-4" />
			</button>
		</div>
	{/if}
</div>