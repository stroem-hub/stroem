<script lang="ts">
	import { Button, Select } from '$lib/components';
	import { ChevronLeftIcon, ChevronRightIcon } from '$lib/components/icons';

	interface Props {
		currentPage: number;
		totalPages: number;
		totalItems: number;
		itemsPerPage: number;
		onPageChange: (page: number) => void;
		onPageSizeChange: (size: number) => void;
		pageSizeOptions?: number[];
		loading?: boolean;
		class?: string;
	}

	let { 
		currentPage, 
		totalPages, 
		totalItems, 
		itemsPerPage, 
		onPageChange, 
		onPageSizeChange,
		pageSizeOptions = [10, 25, 50, 100],
		loading = false,
		class: className = ''
	}: Props = $props();

	let pageInput = $state(currentPage.toString());

	// Update page input when currentPage changes
	$effect(() => {
		pageInput = currentPage.toString();
	});

	function handlePageInputChange() {
		const page = parseInt(pageInput);
		if (page >= 1 && page <= totalPages) {
			onPageChange(page);
		} else {
			// Reset to current page if invalid
			pageInput = currentPage.toString();
		}
	}

	function handlePageInputKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			handlePageInputChange();
		}
	}

	function goToFirstPage() {
		if (currentPage > 1) {
			onPageChange(1);
		}
	}

	function goToPreviousPage() {
		if (currentPage > 1) {
			onPageChange(currentPage - 1);
		}
	}

	function goToNextPage() {
		if (currentPage < totalPages) {
			onPageChange(currentPage + 1);
		}
	}

	function goToLastPage() {
		if (currentPage < totalPages) {
			onPageChange(totalPages);
		}
	}

	function handlePageSizeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newSize = parseInt(target.value);
		onPageSizeChange(newSize);
	}

	// Calculate display range
	const startItem = (currentPage - 1) * itemsPerPage + 1;
	const endItem = Math.min(currentPage * itemsPerPage, totalItems);

	// Generate page size options for select
	const pageSizeSelectOptions = pageSizeOptions.map(size => ({
		value: size.toString(),
		label: `${size} per page`
	}));
</script>

<div class="flex flex-col sm:flex-row items-center justify-between gap-4 {className}" role="navigation" aria-label="Pagination">
	<!-- Items info and page size selector -->
	<div class="flex items-center gap-4 text-sm text-gray-700 dark:text-gray-300">
		<span>
			Showing {startItem}-{endItem} of {totalItems} items
		</span>
		
		<div class="flex items-center gap-2">
			<label for="page-size-select" class="sr-only">Items per page</label>
			<Select
				id="page-size-select"
				value={itemsPerPage.toString()}
				options={pageSizeSelectOptions}
				onchange={handlePageSizeChange}
				disabled={loading}
				class="w-auto min-w-0"
			/>
		</div>
	</div>

	<!-- Pagination controls -->
	{#if totalPages > 1}
		<div class="flex items-center gap-2">
			<!-- First page button -->
			<Button
				variant="outline"
				size="sm"
				onclick={goToFirstPage}
				disabled={currentPage === 1 || loading}
				aria-label="Go to first page"
				class="px-2"
			>
				{#snippet children()}
					<span class="text-xs">First</span>
				{/snippet}
			</Button>

			<!-- Previous page button -->
			<Button
				variant="outline"
				size="sm"
				onclick={goToPreviousPage}
				disabled={currentPage === 1 || loading}
				aria-label="Go to previous page"
				class="px-2"
			>
				{#snippet children()}
					<ChevronLeftIcon class="w-4 h-4" />
				{/snippet}
			</Button>

			<!-- Page input -->
			<div class="flex items-center gap-2 text-sm">
				<span class="text-gray-700 dark:text-gray-300">Page</span>
				<input
					type="number"
					bind:value={pageInput}
					onblur={handlePageInputChange}
					onkeydown={handlePageInputKeydown}
					min="1"
					max={totalPages}
					disabled={loading}
					class="w-16 px-2 py-1 text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
					aria-label="Current page number"
				/>
				<span class="text-gray-700 dark:text-gray-300">of {totalPages}</span>
			</div>

			<!-- Next page button -->
			<Button
				variant="outline"
				size="sm"
				onclick={goToNextPage}
				disabled={currentPage === totalPages || loading}
				aria-label="Go to next page"
				class="px-2"
			>
				{#snippet children()}
					<ChevronRightIcon class="w-4 h-4" />
				{/snippet}
			</Button>

			<!-- Last page button -->
			<Button
				variant="outline"
				size="sm"
				onclick={goToLastPage}
				disabled={currentPage === totalPages || loading}
				aria-label="Go to last page"
				class="px-2"
			>
				{#snippet children()}
					<span class="text-xs">Last</span>
				{/snippet}
			</Button>
		</div>
	{/if}

	<!-- Loading indicator -->
	{#if loading}
		<div class="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
			<div class="animate-spin w-4 h-4 border-2 border-gray-300 border-t-primary-500 rounded-full"></div>
			<span>Loading...</span>
		</div>
	{/if}
</div>