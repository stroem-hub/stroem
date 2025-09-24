import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import Table from './Table.svelte';

describe('Table Component', () => {
	const mockColumns = [
		{ key: 'id', label: 'ID', sortable: true },
		{ key: 'name', label: 'Name', sortable: true },
		{ key: 'status', label: 'Status', align: 'center' as const },
		{ key: 'date', label: 'Date', align: 'right' as const }
	];

	const mockData = [
		{ id: 1, name: 'Task 1', status: 'Active', date: '2024-01-01' },
		{ id: 2, name: 'Task 2', status: 'Inactive', date: '2024-01-02' },
		{ id: 3, name: 'Task 3', status: 'Pending', date: '2024-01-03' }
	];

	it('renders table with data correctly', () => {
		render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		// Check headers are rendered
		expect(screen.getByText('ID')).toBeInTheDocument();
		expect(screen.getByText('Name')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
		expect(screen.getByText('Date')).toBeInTheDocument();

		// Check data is rendered
		expect(screen.getByText('Task 1')).toBeInTheDocument();
		expect(screen.getByText('Task 2')).toBeInTheDocument();
		expect(screen.getByText('Task 3')).toBeInTheDocument();
	});

	it('shows loading state correctly', () => {
		render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				loading: true
			}
		});

		expect(screen.getByText('Loading...')).toBeInTheDocument();
	});

	it('shows empty state correctly', () => {
		render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				emptyMessage: 'No tasks found'
			}
		});

		expect(screen.getByText('No tasks found')).toBeInTheDocument();
	});

	it('shows error state correctly', () => {
		render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				errorMessage: 'Failed to load data'
			}
		});

		expect(screen.getByText('Failed to load data')).toBeInTheDocument();
	});

	it('handles sorting correctly', async () => {
		const onSort = vi.fn();
		
		render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				onSort
			}
		});

		// Click on sortable column header
		const idHeader = screen.getByText('ID').closest('th');
		await idHeader?.click();

		expect(onSort).toHaveBeenCalledWith({ key: 'id', direction: 'asc' });
	});

	it('handles row selection correctly', async () => {
		const onRowSelect = vi.fn();
		const selectedRows = new Set();

		render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				selectedRows,
				onRowSelect
			}
		});

		// Find and click first row checkbox
		const checkboxes = screen.getAllByRole('checkbox');
		const firstRowCheckbox = checkboxes[1]; // Skip the select-all checkbox
		await firstRowCheckbox.click();

		expect(onRowSelect).toHaveBeenCalledWith(1, true);
	});

	it('handles select all correctly', async () => {
		const onSelectAll = vi.fn();
		const selectedRows = new Set();

		render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				selectedRows,
				onSelectAll
			}
		});

		// Find and click select-all checkbox
		const checkboxes = screen.getAllByRole('checkbox');
		const selectAllCheckbox = checkboxes[0];
		await selectAllCheckbox.click();

		expect(onSelectAll).toHaveBeenCalledWith(true);
	});

	it('supports custom snippets for empty and error states', () => {
		const { component } = render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				emptyState: () => 'Custom empty state'
			}
		});

		expect(screen.getByText('Custom empty state')).toBeInTheDocument();
	});

	it('applies custom classes correctly', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				class: 'custom-table-class'
			}
		});

		const table = container.querySelector('table');
		expect(table).toHaveClass('custom-table-class');
	});

	it('handles column alignment correctly', () => {
		render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		// Check that status column (center aligned) has correct class
		const statusCells = screen.getAllByText('Active')[0].closest('td');
		expect(statusCells).toHaveClass('text-center');

		// Check that date column (right aligned) has correct class
		const dateCells = screen.getAllByText('2024-01-01')[0].closest('td');
		expect(dateCells).toHaveClass('text-right');
	});
});