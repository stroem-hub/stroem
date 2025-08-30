<script lang="ts">
	import type { PageProps } from './$types';
	import { TaskCard, Pagination, Alert, Input, Select, Button } from '$lib/components';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { debounce } from '$lib/utils';
	import type { EnhancedTask } from '$lib/types';

	let { data }: PageProps = $props();

	// Loading state
	let loading = $state(false);

	// Search input state
	let searchInput = $state(data.queryParams.search);

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

	// Debounced search function
	const debouncedSearch = debounce((searchTerm: string) => {
		updateUrl({ search: searchTerm, page: 1 });
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
		updateUrl({ sort: target.value, page: 1 });
	}

	// Handle order changes
	function handleOrderChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		updateUrl({ order: target.value, page: 1 });
	}

	// Handle pagination changes
	function handlePageChange(newPage: number) {
		updateUrl({ page: newPage });
	}

	function handlePageSizeChange(newSize: number) {
		updateUrl({ limit: newSize, page: 1 });
	}

	// Update URL with new parameters
	function updateUrl(params: Record<string, string | number>) {
		loading = true;
		
		const url = new URL(page.url);
		
		// Update search params
		Object.entries(params).forEach(([key, value]) => {
			if (value === '' || value === null || value === undefined) {
				url.searchParams.delete(key);
			} else {
				url.searchParams.set(key, value.toString());
			}
		});

		// Navigate to new URL
		goto(url.pathname + url.search, { replaceState: false, noScroll: true })
			.finally(() => {
				loading = false;
			});
	}

	// Navigate to task detail
	function viewTask(taskId: string) {
		goto(`/tasks/${taskId}`);
	}

	// Clear search
	function clearSearch() {
		searchInput = '';
		updateUrl({ search: '', page: 1 });
	}

	// Reset all filters
	function resetFilters() {
		searchInput = '';
		updateUrl({ 
			search: '', 
			sort: 'name', 
			order: 'asc', 
			page: 1, 
			limit: 25 
		});
	}
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
		
		<!-- Quick stats -->
		{#if data.pagination.total > 0}
			<div class="text-sm text-gray-600 dark:text-gray-400">
				{data.pagination.total} task{data.pagination.total === 1 ? '' : 's'} total
			</div>
		{/if}
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
						placeholder="Search tasks by name or description..."
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
					value={data.queryParams.sort}
					options={sortOptions}
					onchange={handleSortChange}
					disabled={loading}
					aria-label="Sort by"
				/>
				<Select
					value={data.queryParams.order}
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
	{#if data.tasks.length > 0}
		<div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
			{#each data.tasks as task (task.id)}
				<TaskCard
					{task}
					onclick={() => viewTask(task.id)}
					class="h-full"
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
				{data.queryParams.search ? 'No tasks found' : 'No tasks available'}
			</h3>
			<p class="text-gray-600 dark:text-gray-400 mb-4">
				{data.queryParams.search 
					? `No tasks match your search for "${data.queryParams.search}"`
					: 'There are no workflow tasks configured yet.'
				}
			</p>
			{#if data.queryParams.search}
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