<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'class'> {
		variant?: 'default' | 'outlined' | 'elevated';
		padding?: 'none' | 'sm' | 'md' | 'lg';
		class?: string;
		header?: Snippet;
		children?: Snippet;
		footer?: Snippet;
	}

	let {
		variant = 'default',
		padding = 'md',
		class: className = '',
		header,
		children,
		footer,
		...restProps
	}: CardProps = $props();

	// Base card classes
	const baseClasses = [
		'bg-white',
		'dark:bg-gray-800',
		'transition-colors',
		'duration-200'
	];

	// Variant classes
	const variantClasses = {
		default: [
			'border',
			'border-gray-200',
			'dark:border-gray-700',
			'rounded-lg'
		],
		outlined: [
			'border-2',
			'border-gray-300',
			'dark:border-gray-600',
			'rounded-lg'
		],
		elevated: [
			'border',
			'border-gray-200',
			'dark:border-gray-700',
			'rounded-lg',
			'shadow-md',
			'hover:shadow-lg',
			'transition-shadow',
			'duration-200'
		]
	};

	// Padding classes for the card container
	const paddingClasses = {
		none: [],
		sm: ['p-3'],
		md: ['p-4'],
		lg: ['p-6']
	};

	// Inner padding classes for sections
	const sectionPaddingClasses = {
		none: {
			header: [],
			body: [],
			footer: []
		},
		sm: {
			header: ['px-3', 'pt-3', 'pb-2'],
			body: ['px-3', 'py-2'],
			footer: ['px-3', 'pt-2', 'pb-3']
		},
		md: {
			header: ['px-4', 'pt-4', 'pb-3'],
			body: ['px-4', 'py-3'],
			footer: ['px-4', 'pt-3', 'pb-4']
		},
		lg: {
			header: ['px-6', 'pt-6', 'pb-4'],
			body: ['px-6', 'py-4'],
			footer: ['px-6', 'pt-4', 'pb-6']
		}
	};

	// Combine all classes
	const cardClasses = [
		...baseClasses,
		...variantClasses[variant],
		...(padding === 'none' ? [] : paddingClasses[padding]),
		className
	].join(' ');

	// Section classes when using slots
	const headerClasses = padding === 'none' ? sectionPaddingClasses[padding].header.join(' ') : '';
	const bodyClasses = padding === 'none' ? sectionPaddingClasses[padding].body.join(' ') : '';
	const footerClasses = padding === 'none' ? sectionPaddingClasses[padding].footer.join(' ') : '';

	// Responsive behavior classes
	const responsiveClasses = [
		'w-full',
		'max-w-full'
	];

	const finalClasses = [cardClasses, ...responsiveClasses].join(' ');
</script>

<div class={finalClasses} {...restProps}>
	{#if header}
		<div class={`border-b border-gray-200 dark:border-gray-700 ${headerClasses}`}>
			{@render header()}
		</div>
	{/if}
	
	{#if children}
		<div class={bodyClasses}>
			{@render children()}
		</div>
	{/if}
	
	{#if footer}
		<div class={`border-t border-gray-200 dark:border-gray-700 ${footerClasses}`}>
			{@render footer()}
		</div>
	{/if}
</div>