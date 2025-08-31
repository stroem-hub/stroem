<script lang="ts">
	import { Select, Input, Button } from '$lib/components';
	import { FilterIcon, XIcon } from '$lib/components/icons';

	interface Props {
		status?: string;
		sort?: string;
		order?: string;
		onStatusChange: (status: string | undefined) => void;
		onSortChange: (sort: string, order: string) => void;
		onClearFilters: () => void;
		class?: string;
	}

	let { 
		status,
		sort = 'start_datetime',
		order = 'desc',
		onStatusChange,
		onSortChange,
		onClearFilters,
		class: className = ''
	}: Props = $props();

	const statusOptions = [
		{ value: '', label: 'All statuses' },
		{ value: 'queued', label: 'Queued' },
		{ value: 'running', label: 'Running' },
		{ value: 'completed', label: 'Completed' },
		{ value: 'failed', label: 'Failed' }
	];

	const sortOptions = [
		{ value: 'start_datetime', label: 'Start time' },
		{ value: 'end_datetime', label: 'End time' },
		{ value: 'duration', label: 'Duration' },
		{ value: 'status', label: 'Status' }
	];

	const orderOptions = [
		{ value: 'desc', label: 'Descending' },
		{ value: 'asc', label: 'Ascending' }
	];

	function handleStatusChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newStatus = target.value || undefined;
		onStatusChange(newStatus);
	}

	function handleSortChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onSortChange(target.value, order);
	}

	function handleOrderChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		onSortChange(sort, target.value);
	}

	// Check if any filters are active
	const hasActiveFilters = $derived(status !== undefined && status !== '');
</script>

<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg {className}">
	<div class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
		<FilterIcon class="w-4 h-4" />
		<span>Filters:</span>
	</div>

	<div class="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
		<!-- Status Filter -->
		<div class="flex items-center gap-2">
			<label for="status-filter" class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
				Status:
			</label>
			<Select
				id="status-filter"
				value={status || ''}
				options={statusOptions}
				onchange={handleStatusChange}
				class="w-auto min-w-0"
			/>
		</div>

		<!-- Sort Options -->
		<div class="flex items-center gap-2">
			<label for="sort-field" class="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
				Sort by:
			</label>
			<Select
				id="sort-field"
				value={sort}
				options={sortOptions}
				onchange={handleSortChange}
				class="w-auto min-w-0"
			/>
			<Select
				id="sort-order"
				value={order}
				options={orderOptions}
				onchange={handleOrderChange}
				class="w-auto min-w-0"
			/>
		</div>

		<!-- Clear Filters -->
		{#if hasActiveFilters}
			<Button
				variant="outline"
				size="sm"
				onclick={onClearFilters}
				class="flex items-center gap-2"
			>
				{#snippet children()}
					<XIcon class="w-4 h-4" />
					<span>Clear</span>
				{/snippet}
			</Button>
		{/if}
	</div>
</div>