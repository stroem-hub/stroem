<!--
	Enhanced Task List Page with URL State Management
	
	This page implements comprehensive URL state management for task list navigation:
	
	Features:
	- URL parameter synchronization for page, sort, search, and page size
	- Browser back/forward navigation support
	- Deep linking to specific task list states
	- State persistence across page refreshes
	- Clean URLs (only non-default parameters are included)
	- Keyboard shortcuts (/ to focus search, Ctrl/Cmd+R to reset filters)
	- Share current view functionality
	- Automatic URL validation and cleanup
	
	URL Parameters:
	- page: Current page number (default: 1)
	- limit: Items per page (default: 25, valid: 10, 25, 50, 100)
	- sort: Sort field (default: 'name', valid: 'name', 'lastExecution', 'successRate')
	- order: Sort order (default: 'asc', valid: 'asc', 'desc')
	- search: Search term (default: empty string)
	
	Examples:
	- /tasks (default view)
	- /tasks?page=2 (page 2 with defaults)
	- /tasks?search=test&sort=lastExecution&order=desc (filtered and sorted)
	- /tasks?page=3&limit=50&search=workflow (custom page size and search)
-->
<script lang="ts">
	import type { PageProps } from './$types';
	import { TaskCard, TaskCardSkeleton, Pagination, Alert, Input, Select, Button, ErrorBoundary } from '$lib/components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { debounce, buildCleanUrl, createShareableUrl } from '$lib/utils';
	import type { EnhancedTask } from '$lib/types';
	import { browser } from '$app/environment';

	let { data }: PageProps = $props();

	// Loading state
	let loading = $state(false);

	// Search input state - sync with URL parameters
	let searchInput = $state(data.queryParams.search || '');

	// Current URL state - track all parameters
	let currentParams = $state({
		page: data.queryParams.page,
		limit: data.queryParams.limit,
		sort: data.queryParams.sort as 'name' | 'lastExecution' | 'successRate',
		order: data.queryParams.order as 'asc' | 'desc',
		search: data.queryParams.search || ''
	});

	// Sort options
	const sortOptions = [
		{ value: 'name', label: 'Name' },
		{ value: 'lastExecution', label: 'Last Execution' },
		{ value: 'successRate', label: 'Success Rate' }
	];

	const orderOptions = [
		{ value: 'asc', label: 'Ascending' },
		{ value: 'desc', label: 'Descending' }
	];

	// Default parameters for clean URLs
	const defaultParams = {
		page: 1,
		limit: 25,
		sort: 'name' as const,
		order: 'asc' as const,
		search: ''
	};

	// Update current params when data changes (for browser navigation)
	$effect(() => {
		const newParams = {
			page: data.queryParams.page,
			limit: data.queryParams.limit,
			sort: data.queryParams.sort,
			order: data.queryParams.order,
			search: data.queryParams.search || ''
		};
		
		// Only update if params actually changed to avoid infinite loops
		if (JSON.stringify(currentParams) !== JSON.stringify(newParams)) {
			currentParams = newParams;
			searchInput = data.queryParams.search || '';
		}
	});

	// Validate URL state on mount and redirect if invalid
	$effect(() => {
		if (!browser) return;
		
		// Check if current URL matches the expected clean URL
		const expectedUrl = buildCleanUrl('/tasks', currentParams, defaultParams);
		const currentUrl = page.url.pathname + page.url.search;
		
		// If URLs don't match, redirect to clean URL (this handles invalid parameters)
		if (currentUrl !== expectedUrl && currentUrl !== '/tasks') {
			goto(expectedUrl, { replaceState: true });
		}
	});

	// Debounced search function
	const debouncedSearch = debounce((searchTerm: string) => {
		updateUrlState({ search: searchTerm, page: 1 });
	}, 300);

	// Handle search input changes
	function handleSearchInput(event: Event) {
		const target = event.target as HTMLInputElement;
		searchInput = target.value;
		debouncedSearch(searchInput);
	}

	// Handle sort changes
	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		updateUrlState({ sort: target.value as 'name' | 'lastExecution' | 'successRate', page: 1 });
	}

	// Handle order changes
	function handleOrderChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		updateUrlState({ order: target.value as 'asc' | 'desc', page: 1 });
	}

	// Handle pagination changes
	function handlePageChange(newPage: number) {
		updateUrlState({ page: newPage });
	}

	function handlePageSizeChange(newSize: number) {
		updateUrlState({ limit: newSize, page: 1 });
	}

	// Enhanced URL state management
	function updateUrlState(newParams: Partial<typeof currentParams>) {
		if (!browser) return;
		
		loading = true;
		
		// Merge new parameters with current state
		const updatedParams = { ...currentParams, ...newParams };
		
		// Build clean URL using utility function
		const newUrl = buildCleanUrl('/tasks', updatedParams, defaultParams);

		// Update current params state
		currentParams = updatedParams;

		// Determine if we should replace or push state
		// Replace state for search changes to avoid cluttering history
		const replaceState = 'search' in newParams;

		// Navigate to new URL with proper state management
		goto(newUrl, { 
			replaceState, 
			noScroll: true,
			keepFocus: true
		}).finally(() => {
			loading = false;
		});
	}

	// Build URL for deep linking
	function buildTaskListUrl(params: Partial<typeof currentParams> = {}) {
		const mergedParams = { ...currentParams, ...params };
		return buildCleanUrl('/tasks', mergedParams, defaultParams);
	}

	// Get current state for sharing/bookmarking
	function getCurrentStateUrl() {
		return createShareableUrl('/tasks', currentParams, defaultParams);
	}

	// Copy current URL to clipboard for sharing
	async function copyCurrentUrl() {
		if (!browser) return;
		
		try {
			const url = window.location.origin + getCurrentStateUrl();
			await navigator.clipboard.writeText(url);
			// Could show a toast notification here
		} catch (error) {
			console.error('Failed to copy URL:', error);
		}
	}

	// Navigate to task detail
	function viewTask(taskId: string) {
		goto(`/tasks/${taskId}`);
	}

	// Clear search
	function clearSearch() {
		searchInput = '';
		updateUrlState({ search: '', page: 1 });
	}

	// Reset all filters to defaults
	function resetFilters() {
		searchInput = '';
		updateUrlState(defaultParams);
	}

	// Handle keyboard shortcuts for navigation
	function handleKeydown(event: KeyboardEvent) {
		if (!browser) return;
		
		// Don't handle shortcuts when typing in inputs
		if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
			return;
		}
		
		// Handle keyboard shortcuts
		switch (event.key) {
			case '/':
				// Focus search input
				event.preventDefault();
				const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
				searchInput?.focus();
				break;
			case 'r':
				// Reset filters
				if (event.ctrlKey || event.metaKey) {
					event.preventDefault();
					resetFilters();
				}
				break;
		}
	}

	// Set up keyboard event listener
	$effect(() => {
		if (browser) {
			document.addEventListener('keydown', handleKeydown);
			
			return () => {
				document.removeEventListener('keydown', handleKeydown);
			};
		}
	});
</script>

<svelte:head>
	<title>Tasks - Strøm</title>
</svelte:head>

<div class="space-y-6">
	<!-- Page Header -->
	<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
		<div>
			<h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Tasks</h1>
			<p class="text-gray-600 dark:text-gray-400 mt-1">
				Manage and monitor your workflow tasks
			</p>
		</div>
		
		<div class="flex items-center gap-4">
			<!-- Quick stats -->
			{#if data.pagination.total > 0}
				<div class="text-sm text-gray-600 dark:text-gray-400">
					{data.pagination.total} task{data.pagination.total === 1 ? '' : 's'} total
				</div>
			{/if}
			
			<!-- Share current view -->
			{#if browser && (currentParams.search || currentParams.sort !== 'name' || currentParams.order !== 'asc' || currentParams.page !== 1 || currentParams.limit !== 25)}
				<Button
					variant="outline"
					size="sm"
					onclick={copyCurrentUrl}
					disabled={loading}
					class="whitespace-nowrap"
					title="Copy link to current view"
				>
					{#snippet children()}
						<svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
						</svg>
						Share View
					{/snippet}
				</Button>
			{/if}
		</div>
	</div>

	<!-- Error Alert -->
	{#if data.error}
		<Alert variant="error">
			{#snippet children()}
				<p>Failed to load tasks: {data.error}</p>
				<Button variant="outline" size="sm" onclick={() => window.location.reload()} class="mt-2">
					{#snippet children()}
						Retry
					{/snippet}
				</Button>
			{/snippet}
		</Alert>
	{/if}

	<!-- Filters and Search -->
	<div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
		<div class="flex flex-col lg:flex-row gap-4">
			<!-- Search -->
			<div class="flex-1">
				<div class="relative">
					<Input
						type="text"
						placeholder="Search tasks by name or description... (Press / to focus)"
						value={searchInput}
						oninput={handleSearchInput}
						disabled={loading}
						class="pr-20"
					/>
					{#if searchInput}
						<button
							type="button"
							onclick={clearSearch}
							disabled={loading}
							class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50"
							aria-label="Clear search"
						>
							<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
							</svg>
						</button>
					{/if}
				</div>
			</div>

			<!-- Sort Controls -->
			<div class="flex gap-2">
				<Select
					value={currentParams.sort}
					options={sortOptions}
					onchange={handleSortChange}
					disabled={loading}
					aria-label="Sort by"
				/>
				<Select
					value={currentParams.order}
					options={orderOptions}
					onchange={handleOrderChange}
					disabled={loading}
					aria-label="Sort order"
				/>
			</div>

			<!-- Reset Button -->
			<Button
				variant="outline"
				onclick={resetFilters}
				disabled={loading}
				class="whitespace-nowrap"
			>
				{#snippet children()}
					Reset Filters
				{/snippet}
			</Button>
		</div>
	</div>

	<!-- Task Grid -->
	{#if loading}
		<!-- Loading skeleton grid -->
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each Array(6) as _}
				<TaskCardSkeleton class="h-full" />
			{/each}
		</div>
	{:else if data.error}
		<!-- Error state handled above -->
	{:else if data.tasks.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each data.tasks as task (task.id)}
				<TaskCard
					{task}
					onclick={() => viewTask(task.id)}
					class="h-full"
					onRetry={() => window.location.reload()}
				/>
			{/each}
		</div>

		<!-- Pagination -->
		{#if data.pagination.total_pages > 1}
			<div class="flex justify-center">
				<Pagination
					currentPage={data.pagination.page}
					totalPages={data.pagination.total_pages}
					totalItems={data.pagination.total}
					itemsPerPage={data.pagination.limit}
					onPageChange={handlePageChange}
					onPageSizeChange={handlePageSizeChange}
					{loading}
					class="w-full"
				/>
			</div>
		{/if}
	{:else if !data.error}
		<!-- Empty State -->
		<div class="text-center py-12">
			<div class="mx-auto w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
				<svg class="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
				</svg>
			</div>
			<h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
				{currentParams.search ? 'No tasks found' : 'No tasks available'}
			</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				{currentParams.search 
					? `No tasks match your search for "${currentParams.search}"`
					: 'There are no workflow tasks configured yet.'
				}
			</p>
			{#if currentParams.search}
				<Button variant="outline" onclick={clearSearch}>
					{#snippet children()}
						Clear Search
					{/snippet}
				</Button>
			{/if}
		</div>
	{/if}

	<!-- Loading Overlay -->
	{#if loading}
		<div class="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
			<div class="bg-white dark:bg-gray-800 rounded-lg p-6 flex items-center gap-3">
				<div class="animate-spin w-5 h-5 border-2 border-gray-300 border-t-primary-500 rounded-full"></div>
				<span class="text-gray-900 dark:text-gray-100">Loading tasks...</span>
			</div>
		</div>
	{/if}
</div>