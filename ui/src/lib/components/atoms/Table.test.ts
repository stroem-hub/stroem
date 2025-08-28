import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Table from './Table.svelte';

const mockColumns = [
	{ key: 'id', label: 'ID', sortable: true, width: '80px' },
	{ key: 'name', label: 'Name', sortable: true },
	{ key: 'email', label: 'Email', sortable: false },
	{ key: 'status', label: 'Status', align: 'center' as const }
];

const mockData = [
	{ id: 1, name: 'John Doe', email: 'john@example.com', status: 'Active' },
	{ id: 2, name: 'Jane Smith', email: 'jane@example.com', status: 'Inactive' },
	{ id: 3, name: 'Bob Johnson', email: 'bob@example.com', status: 'Active' }
];

describe('Table', () => {
	it('renders with basic props', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const table = container.querySelector('table');
		expect(table).toBeInTheDocument();
		expect(table).toHaveClass('w-full', 'border-collapse', 'bg-white', 'dark:bg-gray-800');
	});

	it('renders column headers correctly', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const headers = container.querySelectorAll('th');
		expect(headers).toHaveLength(4);
		expect(headers[0]).toHaveTextContent('ID');
		expect(headers[1]).toHaveTextContent('Name');
		expect(headers[2]).toHaveTextContent('Email');
		expect(headers[3]).toHaveTextContent('Status');
	});

	it('renders data rows correctly', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const rows = container.querySelectorAll('tbody tr');
		expect(rows).toHaveLength(3);

		// Check first row data
		const firstRowCells = rows[0].querySelectorAll('td');
		expect(firstRowCells[0]).toHaveTextContent('1');
		expect(firstRowCells[1]).toHaveTextContent('John Doe');
		expect(firstRowCells[2]).toHaveTextContent('john@example.com');
		expect(firstRowCells[3]).toHaveTextContent('Active');
	});

	it('applies column width styles', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const firstHeader = container.querySelector('th');
		expect(firstHeader).toHaveStyle('width: 80px');
	});

	it('applies column alignment classes', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const statusHeader = container.querySelectorAll('th')[3];
		const statusCell = container.querySelector('tbody tr td:nth-child(4)');
		
		expect(statusHeader).toHaveClass('text-center');
		expect(statusCell).toHaveClass('text-center');
	});

	it('shows sortable column indicators', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				sortable: true
			}
		});

		const sortableHeaders = container.querySelectorAll('th svg');
		expect(sortableHeaders).toHaveLength(2); // ID and Name columns are sortable
	});

	it('handles column sorting', async () => {
		const user = userEvent.setup();
		const handleSort = vi.fn();

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				sortable: true,
				onSort: handleSort
			}
		});

		const nameHeader = container.querySelectorAll('th')[1];
		await user.click(nameHeader);

		expect(handleSort).toHaveBeenCalledWith({ key: 'name', direction: 'asc' });
	});

	it('toggles sort direction on repeated clicks', async () => {
		const user = userEvent.setup();
		const handleSort = vi.fn();

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				sortable: true,
				sortConfig: { key: 'name', direction: 'asc' },
				onSort: handleSort
			}
		});

		const nameHeader = container.querySelectorAll('th')[1];
		await user.click(nameHeader);

		expect(handleSort).toHaveBeenCalledWith({ key: 'name', direction: 'desc' });
	});

	it('renders selection checkboxes when selectable', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true
			}
		});

		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		expect(checkboxes).toHaveLength(4); // 1 header + 3 rows
	});

	it('handles row selection', async () => {
		const user = userEvent.setup();
		const handleRowSelect = vi.fn();

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				onRowSelect: handleRowSelect
			}
		});

		const firstRowCheckbox = container.querySelectorAll('input[type="checkbox"]')[1];
		await user.click(firstRowCheckbox);

		expect(handleRowSelect).toHaveBeenCalledWith(1, true);
	});

	it('handles select all', async () => {
		const user = userEvent.setup();
		const handleSelectAll = vi.fn();

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				onSelectAll: handleSelectAll
			}
		});

		const selectAllCheckbox = container.querySelector('input[type="checkbox"]');
		await user.click(selectAllCheckbox!);

		expect(handleSelectAll).toHaveBeenCalledWith(true);
	});

	it('shows loading state', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				loading: true
			}
		});

		const loadingText = container.querySelector('tbody td');
		expect(loadingText).toHaveTextContent('Loading...');
		
		const spinner = container.querySelector('svg.animate-spin');
		expect(spinner).toBeInTheDocument();
	});

	it('shows empty state', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				emptyMessage: 'No users found'
			}
		});

		const emptyText = container.querySelector('tbody td');
		expect(emptyText).toHaveTextContent('No users found');
	});

	it('shows error state', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: [],
				errorMessage: 'Failed to load data'
			}
		});

		const errorText = container.querySelector('tbody td');
		expect(errorText).toHaveTextContent('Failed to load data');
	});

	it('uses custom render function for columns', () => {
		const columnsWithRender = [
			...mockColumns,
			{
				key: 'actions',
				label: 'Actions',
				render: (value: any, row: any) => `Edit ${row.name}`
			}
		];

		const dataWithActions = mockData.map(item => ({ ...item, actions: null }));

		const { container } = render(Table, {
			props: {
				columns: columnsWithRender,
				data: dataWithActions
			}
		});

		const actionCells = container.querySelectorAll('tbody tr td:last-child');
		expect(actionCells[0]).toHaveTextContent('Edit John Doe');
		expect(actionCells[1]).toHaveTextContent('Edit Jane Smith');
	});

	it('applies custom className', () => {
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

	it('passes through additional HTML attributes', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				'data-testid': 'custom-table',
				'aria-label': 'Data table'
			}
		});

		const table = container.querySelector('table');
		expect(table).toHaveAttribute('data-testid', 'custom-table');
		expect(table).toHaveAttribute('aria-label', 'Data table');
	});

	it('handles empty columns array', () => {
		const { container } = render(Table, {
			props: {
				columns: [],
				data: mockData
			}
		});

		const headers = container.querySelectorAll('th');
		expect(headers).toHaveLength(0);
	});

	it('handles missing row key gracefully', () => {
		const dataWithoutId = [
			{ name: 'John', email: 'john@example.com' },
			{ name: 'Jane', email: 'jane@example.com' }
		];

		const { container } = render(Table, {
			props: {
				columns: [
					{ key: 'name', label: 'Name' },
					{ key: 'email', label: 'Email' }
				],
				data: dataWithoutId,
				selectable: true,
				rowKey: 'id' // This key doesn't exist in data
			}
		});

		const table = container.querySelector('table');
		expect(table).toBeInTheDocument();
	});

	it('shows correct selected state indicators', () => {
		const selectedRows = new Set([1, 2]);

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				selectedRows
			}
		});

		const checkboxes = container.querySelectorAll('input[type="checkbox"]');
		const headerCheckbox = checkboxes[0] as HTMLInputElement;
		const firstRowCheckbox = checkboxes[1] as HTMLInputElement;
		const secondRowCheckbox = checkboxes[2] as HTMLInputElement;
		const thirdRowCheckbox = checkboxes[3] as HTMLInputElement;

		expect(firstRowCheckbox.checked).toBe(true);
		expect(secondRowCheckbox.checked).toBe(true);
		expect(thirdRowCheckbox.checked).toBe(false);
		expect(headerCheckbox.indeterminate).toBe(true); // Some but not all selected
	});

	it('shows all selected state', () => {
		const selectedRows = new Set([1, 2, 3]);

		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData,
				selectable: true,
				selectedRows
			}
		});

		const headerCheckbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
		expect(headerCheckbox.checked).toBe(true);
		expect(headerCheckbox.indeterminate).toBe(false);
	});

	it('has proper hover effects on rows', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const rows = container.querySelectorAll('tbody tr');
		rows.forEach(row => {
			expect(row).toHaveClass('hover:bg-gray-50', 'dark:hover:bg-gray-700', 'transition-colors');
		});
	});

	it('has proper responsive wrapper', () => {
		const { container } = render(Table, {
			props: {
				columns: mockColumns,
				data: mockData
			}
		});

		const wrapper = container.querySelector('div');
		expect(wrapper).toHaveClass('overflow-x-auto');
	});
});