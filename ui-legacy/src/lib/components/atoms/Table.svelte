<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';

	interface TableColumn {
		key: string;
		label: string;
		sortable?: boolean;
		width?: string;
		align?: 'left' | 'center' | 'right';
		render?: (value: any, row: any) => string;
	}

	interface SortConfig {
		key: string;
		direction: 'asc' | 'desc';
	}

	interface TableProps extends Omit<HTMLAttributes<HTMLTableElement>, 'class'> {
		columns: TableColumn[];
		data: any[];
		loading?: boolean;
		sortable?: boolean;
		sortConfig?: SortConfig | null;
		selectable?: boolean;
		selectedRows?: Set<string | number>;
		rowKey?: string;
		emptyMessage?: string;
		errorMessage?: string;
		class?: string;
		onSort?: (sortConfig: SortConfig) => void;
		onRowSelect?: (rowKey: string | number, selected: boolean) => void;
		onSelectAll?: (selected: boolean) => void;
		emptyState?: Snippet;
		errorState?: Snippet;
	}

	let {
		columns = [],
		data = [],
		loading = false,
		sortable = true,
		sortConfig = null,
		selectable = false,
		selectedRows = new Set(),
		rowKey = 'id',
		emptyMessage = 'No data available',
		errorMessage = '',
		class: className = '',
		onSort,
		onRowSelect,
		onSelectAll,
		emptyState,
		errorState,
		...restProps
	}: TableProps = $props();

	// Base table classes
	const baseClasses = [
		'w-full',
		'border-collapse',
		'bg-white',
		'dark:bg-gray-800',
		'shadow-sm',
		'rounded-lg',
		'overflow-hidden'
	];

	// Combine all classes
	const tableClasses = [
		...baseClasses,
		className
	].join(' ');

	// Handle column sorting
	function handleSort(column: TableColumn) {
		if (!sortable || !column.sortable || !onSort) return;

		const newDirection = 
			sortConfig?.key === column.key && sortConfig.direction === 'asc' 
				? 'desc' 
				: 'asc';

		onSort({ key: column.key, direction: newDirection });
	}

	// Handle row selection
	function handleRowSelect(row: any, selected: boolean) {
		if (!selectable || !onRowSelect) return;
		const key = row[rowKey];
		onRowSelect(key, selected);
	}

	// Handle select all
	function handleSelectAll(selected: boolean) {
		if (!selectable || !onSelectAll) return;
		onSelectAll(selected);
	}

	// Check if all rows are selected
	const allSelected = $derived(selectable && data.length > 0 && data.every(row => selectedRows.has(row[rowKey])));
	const someSelected = $derived(selectable && selectedRows.size > 0 && !allSelected);

	// Get sort icon for column
	function getSortIcon(column: TableColumn): string {
		if (!sortable || !column.sortable || sortConfig?.key !== column.key) {
			return 'M7 10l5 5 5-5z'; // Default sort icon
		}
		return sortConfig.direction === 'asc' 
			? 'M7 14l5-5 5 5z' // Sort up
			: 'M7 10l5 5 5-5z'; // Sort down
	}

	// Get cell value
	function getCellValue(row: any, column: TableColumn): string {
		const value = row[column.key];
		return column.render ? column.render(value, row) : String(value || '');
	}

	// Get alignment classes
	function getAlignmentClass(align?: string): string {
		switch (align) {
			case 'center': return 'text-center';
			case 'right': return 'text-right';
			default: return 'text-left';
		}
	}
</script>

<div class="overflow-x-auto">
	<table class={tableClasses} {...restProps}>
		<thead class="bg-gray-50 dark:bg-gray-700">
			<tr>
				{#if selectable}
					<th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-12">
						<input
							type="checkbox"
							checked={allSelected}
							indeterminate={someSelected}
							onchange={(e) => handleSelectAll(e.currentTarget.checked)}
							class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
						/>
					</th>
				{/if}
				
				{#each columns as column}
					<th 
						class={`px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${getAlignmentClass(column.align)} ${column.sortable && sortable ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600' : ''}`}
						style={column.width ? `width: ${column.width}` : ''}
						onclick={() => handleSort(column)}
					>
						<div class="flex items-center gap-1">
							<span>{column.label}</span>
							{#if column.sortable && sortable}
								<svg class="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
									<path d={getSortIcon(column)} />
								</svg>
							{/if}
						</div>
					</th>
				{/each}
			</tr>
		</thead>
		
		<tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
			{#if loading}
				<tr>
					<td colspan={columns.length + (selectable ? 1 : 0)} class="px-6 py-12 text-center">
						<div class="flex items-center justify-center">
							<svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-primary-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
							<span class="text-gray-500 dark:text-gray-400">Loading...</span>
						</div>
					</td>
				</tr>
			{:else if errorMessage}
				<tr>
					<td colspan={columns.length + (selectable ? 1 : 0)} class="px-6 py-12 text-center">
						{#if errorState}
							{@render errorState()}
						{:else}
							<div class="text-error-500 dark:text-error-400">
								<svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
								</svg>
								<p class="text-lg font-medium mb-2">Error</p>
								<p class="text-sm">{errorMessage}</p>
							</div>
						{/if}
					</td>
				</tr>
			{:else if data.length === 0}
				<tr>
					<td colspan={columns.length + (selectable ? 1 : 0)} class="px-6 py-12 text-center">
						{#if emptyState}
							{@render emptyState()}
						{:else}
							<div class="text-gray-500 dark:text-gray-400">
								<svg class="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2 2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"></path>
								</svg>
								<p class="text-lg font-medium mb-2">No data</p>
								<p class="text-sm">{emptyMessage}</p>
							</div>
						{/if}
					</td>
				</tr>
			{:else}
				{#each data as row, index}
					<tr class="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
						{#if selectable}
							<td class="px-6 py-4 whitespace-nowrap w-12">
								<input
									type="checkbox"
									checked={selectedRows.has(row[rowKey])}
									onchange={(e) => handleRowSelect(row, e.currentTarget.checked)}
									class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
								/>
							</td>
						{/if}
						
						{#each columns as column}
							<td 
								class={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 ${getAlignmentClass(column.align)}`}
								style={column.width ? `width: ${column.width}` : ''}
							>
								{getCellValue(row, column)}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>