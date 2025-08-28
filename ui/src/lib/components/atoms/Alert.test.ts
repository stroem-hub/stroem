import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Alert from './Alert.svelte';

describe('Alert Component', () => {
	it('renders with default props', () => {
		render(Alert, {
			props: {
				children: () => 'Test alert message'
			}
		});

		expect(screen.getByRole('alert')).toBeInTheDocument();
		expect(screen.getByText('Test alert message')).toBeInTheDocument();
	});

	it('renders different variants correctly', () => {
		const { rerender } = render(Alert, {
			props: {
				variant: 'success',
				children: () => 'Success message'
			}
		});

		const alert = screen.getByRole('alert');
		expect(alert).toHaveClass('bg-green-50', 'border-green-200', 'text-green-800');

		rerender({
			variant: 'error',
			children: () => 'Error message'
		});

		expect(alert).toHaveClass('bg-red-50', 'border-red-200', 'text-red-800');
	});

	it('shows close button when dismissible', () => {
		render(Alert, {
			props: {
				dismissible: true,
				children: () => 'Dismissible alert'
			}
		});

		expect(screen.getByLabelText('Close alert')).toBeInTheDocument();
	});

	it('calls onclose when close button is clicked', async () => {
		const user = userEvent.setup();
		const onclose = vi.fn();

		render(Alert, {
			props: {
				dismissible: true,
				onclose,
				children: () => 'Dismissible alert'
			}
		});

		const closeButton = screen.getByLabelText('Close alert');
		await user.click(closeButton);

		expect(onclose).toHaveBeenCalledOnce();
	});

	it('renders custom icon when provided', () => {
		render(Alert, {
			props: {
				icon: () => '<svg data-testid="custom-icon"></svg>',
				children: () => 'Alert with custom icon'
			}
		});

		expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
	});

	it('applies custom class names', () => {
		render(Alert, {
			props: {
				class: 'custom-class',
				children: () => 'Alert with custom class'
			}
		});

		expect(screen.getByRole('alert')).toHaveClass('custom-class');
	});
});