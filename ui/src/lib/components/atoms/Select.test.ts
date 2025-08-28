import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Select from './Select.svelte';

const mockOptions = [
	{ value: 'option1', label: 'Option 1' },
	{ value: 'option2', label: 'Option 2' },
	{ value: 'option3', label: 'Option 3', disabled: true }
];

describe('Select', () => {
	it('renders with default props', () => {
		const { container } = render(Select, {
			props: { options: mockOptions }
		});

		const select = container.querySelector('select');
		expect(select).toBeInTheDocument();
		expect(select).toHaveClass('border-gray-300', 'dark:border-gray-600'); // default variant
		expect(select).toHaveClass('px-3', 'py-2', 'text-sm'); // md size
		expect(select).not.toBeDisabled();
	});

	it('renders options correctly', () => {
		const { container } = render(Select, {
			props: { options: mockOptions }
		});

		const options = container.querySelectorAll('option');
		expect(options).toHaveLength(3);
		
		expect(options[0]).toHaveValue('option1');
		expect(options[0]).toHaveTextContent('Option 1');
		expect(options[0]).not.toBeDisabled();
		
		expect(options[1]).toHaveValue('option2');
		expect(options[1]).toHaveTextContent('Option 2');
		
		expect(options[2]).toHaveValue('option3');
		expect(options[2]).toHaveTextContent('Option 3');
		expect(options[2]).toBeDisabled();
	});

	it('renders placeholder correctly', () => {
		const placeholder = 'Select an option';
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				placeholder
			}
		});

		const placeholderOption = container.querySelector('option[value=""]');
		expect(placeholderOption).toBeInTheDocument();
		expect(placeholderOption).toHaveTextContent(placeholder);
		expect(placeholderOption).toBeDisabled();
		expect(placeholderOption).toHaveAttribute('selected');
	});

	it('does not render placeholder for multiple select', () => {
		const placeholder = 'Select options';
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				placeholder,
				multiple: true
			}
		});

		const placeholderOption = container.querySelector('option[value=""]');
		expect(placeholderOption).not.toBeInTheDocument();
	});

	it('renders default variant correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				variant: 'default' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('border-gray-300', 'dark:border-gray-600');
		expect(select).toHaveClass('focus:border-primary-500', 'focus:ring-primary-500');
	});

	it('renders error variant correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				variant: 'error' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(select).toHaveClass('focus:border-error-500', 'focus:ring-error-500');
	});

	it('renders success variant correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				variant: 'success' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('border-success-300', 'dark:border-success-600');
		expect(select).toHaveClass('focus:border-success-500', 'focus:ring-success-500');
	});

	it('renders small size correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				size: 'sm' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('px-3', 'py-1.5', 'text-sm');
	});

	it('renders large size correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				size: 'lg' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('px-4', 'py-3', 'text-base');
	});

	it('handles fullWidth prop correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				fullWidth: true 
			}
		});

		const select = container.querySelector('select');
		const wrapper = container.querySelector('div');
		expect(select).toHaveClass('w-full');
		expect(wrapper).toHaveClass('w-full');
	});

	it('handles disabled state correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				disabled: true 
			}
		});

		const select = container.querySelector('select');
		expect(select).toBeDisabled();
		expect(select).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
	});

	it('handles multiple selection correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				multiple: true 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveAttribute('multiple');
		
		// Should not have dropdown arrow for multiple select
		const arrow = container.querySelector('svg');
		expect(arrow).not.toBeInTheDocument();
	});

	it('displays dropdown arrow for single select', () => {
		const { container } = render(Select, {
			props: { options: mockOptions }
		});

		const arrow = container.querySelector('svg');
		expect(arrow).toBeInTheDocument();
		expect(arrow).toHaveClass('w-5', 'h-5', 'text-gray-400', 'dark:text-gray-500');
	});

	it('displays error message correctly', () => {
		const errorMessage = 'Please select an option';
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				error: errorMessage 
			}
		});

		const select = container.querySelector('select');
		const errorElement = container.querySelector('p[role="alert"]');
		
		expect(select).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(errorElement).toHaveClass('text-error-600', 'dark:text-error-400');
	});

	it('displays success message correctly', () => {
		const successMessage = 'Good choice!';
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				success: successMessage 
			}
		});

		const select = container.querySelector('select');
		const successElement = container.querySelector('p:not([role="alert"])');
		
		expect(select).toHaveClass('border-success-300', 'dark:border-success-600');
		expect(successElement).toBeInTheDocument();
		expect(successElement).toHaveTextContent(successMessage);
		expect(successElement).toHaveClass('text-success-600', 'dark:text-success-400');
	});

	it('prioritizes error over success message', () => {
		const errorMessage = 'Please select an option';
		const successMessage = 'Good choice!';
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				error: errorMessage,
				success: successMessage
			}
		});

		const select = container.querySelector('select');
		const errorElement = container.querySelector('p[role="alert"]');
		const successElement = container.querySelector('p:not([role="alert"])');
		
		expect(select).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(successElement).not.toBeInTheDocument();
	});

	it('applies custom className correctly', () => {
		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				class: 'custom-select-class' 
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('custom-select-class');
	});

	it('passes through additional HTML attributes', () => {
		const { container } = render(Select, {
			props: {
				options: mockOptions,
				'data-testid': 'custom-select',
				'aria-label': 'Custom select label'
			}
		});

		const select = container.querySelector('select');
		expect(select).toHaveAttribute('data-testid', 'custom-select');
		expect(select).toHaveAttribute('aria-label', 'Custom select label');
	});

	it('handles user selection correctly', async () => {
		const user = userEvent.setup();
		const handleChange = vi.fn();

		const { container } = render(Select, {
			props: { 
				options: mockOptions,
				onchange: handleChange
			}
		});

		const select = container.querySelector('select');
		if (select) {
			await user.selectOptions(select, 'option2');
			expect(select).toHaveValue('option2');
			expect(handleChange).toHaveBeenCalled();
		}
	});

	it('has proper focus styles', () => {
		const { container } = render(Select, {
			props: { options: mockOptions }
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
	});

	it('has proper appearance classes', () => {
		const { container } = render(Select, {
			props: { options: mockOptions }
		});

		const select = container.querySelector('select');
		expect(select).toHaveClass('appearance-none', 'bg-no-repeat', 'bg-right', 'pr-10');
	});

	it('handles empty options array', () => {
		const { container } = render(Select, {
			props: { options: [] }
		});

		const select = container.querySelector('select');
		const options = container.querySelectorAll('option');
		
		expect(select).toBeInTheDocument();
		expect(options).toHaveLength(0);
	});

	it('handles numeric option values', () => {
		const numericOptions = [
			{ value: 1, label: 'One' },
			{ value: 2, label: 'Two' },
			{ value: 3, label: 'Three' }
		];

		const { container } = render(Select, {
			props: { options: numericOptions }
		});

		const options = container.querySelectorAll('option');
		expect(options[0]).toHaveValue('1');
		expect(options[1]).toHaveValue('2');
		expect(options[2]).toHaveValue('3');
	});
});