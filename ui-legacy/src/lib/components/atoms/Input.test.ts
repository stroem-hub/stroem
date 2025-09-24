import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Input from './Input.svelte';

describe('Input', () => {
	it('renders with default props', () => {
		const { container } = render(Input, {
			props: {}
		});

		const input = container.querySelector('input');
		expect(input).toBeInTheDocument();
		expect(input).toHaveClass('border-gray-300', 'dark:border-gray-600'); // default variant
		expect(input).toHaveClass('px-3', 'py-2', 'text-sm'); // md size
		expect(input).not.toBeDisabled();
	});

	it('renders default variant correctly', () => {
		const { container } = render(Input, {
			props: { variant: 'default' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('border-gray-300', 'dark:border-gray-600');
		expect(input).toHaveClass('focus:border-primary-500', 'focus:ring-primary-500');
	});

	it('renders error variant correctly', () => {
		const { container } = render(Input, {
			props: { variant: 'error' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(input).toHaveClass('focus:border-error-500', 'focus:ring-error-500');
	});

	it('renders success variant correctly', () => {
		const { container } = render(Input, {
			props: { variant: 'success' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('border-success-300', 'dark:border-success-600');
		expect(input).toHaveClass('focus:border-success-500', 'focus:ring-success-500');
	});

	it('renders small size correctly', () => {
		const { container } = render(Input, {
			props: { size: 'sm' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('px-3', 'py-1.5', 'text-sm');
	});

	it('renders medium size correctly', () => {
		const { container } = render(Input, {
			props: { size: 'md' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('px-3', 'py-2', 'text-sm');
	});

	it('renders large size correctly', () => {
		const { container } = render(Input, {
			props: { size: 'lg' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('px-4', 'py-3', 'text-base');
	});

	it('handles fullWidth prop correctly', () => {
		const { container } = render(Input, {
			props: { fullWidth: true }
		});

		const input = container.querySelector('input');
		const wrapper = container.querySelector('div');
		expect(input).toHaveClass('w-full');
		expect(wrapper).toHaveClass('w-full');
	});

	it('handles disabled state correctly', () => {
		const { container } = render(Input, {
			props: { disabled: true }
		});

		const input = container.querySelector('input');
		expect(input).toBeDisabled();
		expect(input).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
	});

	it('displays error message correctly', () => {
		const errorMessage = 'This field is required';
		const { container } = render(Input, {
			props: { error: errorMessage }
		});

		const input = container.querySelector('input');
		const errorElement = container.querySelector('p[role="alert"]');
		
		expect(input).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(errorElement).toHaveClass('text-error-600', 'dark:text-error-400');
	});

	it('displays success message correctly', () => {
		const successMessage = 'Input is valid';
		const { container } = render(Input, {
			props: { success: successMessage }
		});

		const input = container.querySelector('input');
		const successElement = container.querySelector('p:not([role="alert"])');
		
		expect(input).toHaveClass('border-success-300', 'dark:border-success-600');
		expect(successElement).toBeInTheDocument();
		expect(successElement).toHaveTextContent(successMessage);
		expect(successElement).toHaveClass('text-success-600', 'dark:text-success-400');
	});

	it('prioritizes error over success message', () => {
		const errorMessage = 'This field is required';
		const successMessage = 'Input is valid';
		const { container } = render(Input, {
			props: { 
				error: errorMessage,
				success: successMessage
			}
		});

		const input = container.querySelector('input');
		const errorElement = container.querySelector('p[role="alert"]');
		const successElement = container.querySelector('p:not([role="alert"])');
		
		expect(input).toHaveClass('border-error-300', 'dark:border-error-600');
		expect(errorElement).toBeInTheDocument();
		expect(errorElement).toHaveTextContent(errorMessage);
		expect(successElement).not.toBeInTheDocument();
	});

	it('applies custom className correctly', () => {
		const { container } = render(Input, {
			props: { class: 'custom-input-class' }
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('custom-input-class');
	});

	it('passes through additional HTML attributes', () => {
		const { container } = render(Input, {
			props: {
				'data-testid': 'custom-input',
				'aria-label': 'Custom input label',
				placeholder: 'Enter text here'
			}
		});

		const input = container.querySelector('input');
		expect(input).toHaveAttribute('data-testid', 'custom-input');
		expect(input).toHaveAttribute('aria-label', 'Custom input label');
		expect(input).toHaveAttribute('placeholder', 'Enter text here');
	});

	it('handles different input types correctly', () => {
		const types = ['text', 'email', 'password', 'number', 'tel', 'url'];

		types.forEach((type) => {
			const { container, unmount } = render(Input, {
				props: { type }
			});

			const input = container.querySelector('input');
			expect(input).toHaveAttribute('type', type);

			unmount();
		});
	});

	it('handles user input correctly', async () => {
		const user = userEvent.setup();
		const handleInput = vi.fn();

		const { container } = render(Input, {
			props: { oninput: handleInput }
		});

		const input = container.querySelector('input');
		if (input) {
			await user.type(input, 'test input');
			expect(input).toHaveValue('test input');
			expect(handleInput).toHaveBeenCalled();
		}
	});

	it('has proper focus styles', () => {
		const { container } = render(Input, {
			props: {}
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
	});

	it('has proper dark mode classes', () => {
		const { container } = render(Input, {
			props: {}
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('dark:bg-gray-900', 'dark:text-gray-100');
		expect(input).toHaveClass('dark:placeholder:text-gray-500');
	});

	it('has proper transition classes', () => {
		const { container } = render(Input, {
			props: {}
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('transition-colors', 'duration-200');
	});

	it('combines variant and size classes correctly', () => {
		const { container } = render(Input, {
			props: { 
				variant: 'error',
				size: 'lg'
			}
		});

		const input = container.querySelector('input');
		expect(input).toHaveClass('border-error-300', 'dark:border-error-600'); // error variant
		expect(input).toHaveClass('px-4', 'py-3', 'text-base'); // lg size
	});

	it('handles all variant and size combinations', () => {
		const variants = ['default', 'error', 'success'] as const;
		const sizes = ['sm', 'md', 'lg'] as const;

		variants.forEach((variant) => {
			sizes.forEach((size) => {
				const { container, unmount } = render(Input, {
					props: { variant, size }
				});

				const input = container.querySelector('input');
				expect(input).toBeInTheDocument();

				// Check variant-specific classes
				switch (variant) {
					case 'default':
						expect(input).toHaveClass('border-gray-300', 'focus:border-primary-500');
						break;
					case 'error':
						expect(input).toHaveClass('border-error-300', 'focus:border-error-500');
						break;
					case 'success':
						expect(input).toHaveClass('border-success-300', 'focus:border-success-500');
						break;
				}

				// Check size-specific classes
				switch (size) {
					case 'sm':
						expect(input).toHaveClass('px-3', 'py-1.5', 'text-sm');
						break;
					case 'md':
						expect(input).toHaveClass('px-3', 'py-2', 'text-sm');
						break;
					case 'lg':
						expect(input).toHaveClass('px-4', 'py-3', 'text-base');
						break;
				}

				unmount();
			});
		});
	});
});