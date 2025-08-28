<script lang="ts">
	import Breadcrumb from '../molecules/Breadcrumb.svelte';
	import type { Breadcrumb as BreadcrumbType } from '$lib/types';
	import type { Snippet } from 'svelte';

	interface Props {
		title?: string;
		subtitle?: string;
		breadcrumbs?: BreadcrumbType[];
		showBreadcrumbs?: boolean;
		actions?: Snippet;
		children: Snippet;
		class?: string;
		contentClass?: string;
		headerClass?: string;
		maxWidth?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | '7xl' | 'full';
		padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
	}

	let {
		title,
		subtitle,
		breadcrumbs = [],
		showBreadcrumbs = true,
		actions,
		children,
		class: className = '',
		contentClass = '',
		headerClass = '',
		maxWidth = '7xl',
		padding = 'lg'
	}: Props = $props();

	const maxWidthClasses = {
		none: '',
		sm: 'max-w-sm',
		md: 'max-w-md',
		lg: 'max-w-lg',
		xl: 'max-w-xl',
		'2xl': 'max-w-2xl',
		'4xl': 'max-w-4xl',
		'6xl': 'max-w-6xl',
		'7xl': 'max-w-7xl',
		full: 'max-w-full'
	};

	const paddingClasses = {
		none: '',
		sm: 'p-4',
		md: 'p-6',
		lg: 'p-6 lg:p-8',
		xl: 'p-8 lg:p-12'
	};

	const containerClass = $derived(() => {
		const classes = ['mx-auto', 'w-full'];

		if (maxWidth !== 'none') {
			classes.push(maxWidthClasses[maxWidth]);
		}

		if (padding !== 'none') {
			classes.push(paddingClasses[padding]);
		}

		return classes.join(' ');
	});

	const shouldShowHeader = $derived(() => {
		return title || subtitle || (showBreadcrumbs && breadcrumbs.length > 0) || actions;
	});
</script>

<div class="min-h-full bg-gray-50 dark:bg-gray-900 {className}">
	<div class={containerClass}>
		{#if shouldShowHeader}
			<header class="mb-6 lg:mb-8 {headerClass}">
				<!-- Breadcrumbs -->
				{#if showBreadcrumbs && breadcrumbs.length > 0}
					<div class="mb-4">
						<Breadcrumb items={breadcrumbs} />
					</div>
				{/if}

				<!-- Title and Actions Row -->
				{#if title || actions}
					<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
						<!-- Title Section -->
						{#if title || subtitle}
							<div class="min-w-0 flex-1">
								{#if title}
									<h1 class="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white truncate">
										{title}
									</h1>
								{/if}
								{#if subtitle}
									<p class="mt-1 text-sm lg:text-base text-gray-600 dark:text-gray-400">
										{subtitle}
									</p>
								{/if}
							</div>
						{/if}

						<!-- Actions Section -->
						{#if actions}
							<div class="flex-shrink-0">
								{@render actions()}
							</div>
						{/if}
					</div>
				{/if}
			</header>
		{/if}

		<!-- Main Content -->
		<main class="flex-1 {contentClass}">
			{@render children()}
		</main>
	</div>
</div>
