import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import Button from './Button.svelte';

// Create a test wrapper component
const TestWrapper = `
<script>
	import Button from './Button.svelte';
	export let variant = 'primary';
	export let size = 'md';
	export let disabled = false;
	export let loading = false;
	export let fullWidth = false;
	export let onclick = undefined;
	export let className = '';
	export let text = 'Test Button';
</script>

<Button 
	{variant} 
	{size} 
	{disabled} 
	{loading} 
	{fullWidth} 
	{onclick}
	class={className}
>
	{text}
</Button>
`;

describe('Button', () => {
	it('renders with default props', () => {
		const { container } = render(Button, {
			props: {}
		});

		const button = container.querySelector('button');
		expect(button).toBeInTheDocument();
		expect(button).toHaveClass('bg-primary-600'); // primary variant
		expect(button).toHaveClass('px-4', 'py-2'); // md size
		expect(button).not.toBeDisabled();
	});

	it('renders primary variant correctly', () => {
		const { container } = render(Button, {
			props: { variant: 'primary' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('bg-primary-600', 'text-white');
	});

	it('renders secondary variant correctly', () => {
		const { container } = render(Button, {
			props: { variant: 'secondary' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('bg-gray-100', 'text-gray-900');
	});

	it('renders outline variant correctly', () => {
		const { container } = render(Button, {
			props: { variant: 'outline' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('border', 'border-gray-300', 'bg-white');
	});

	it('renders ghost variant correctly', () => {
		const { container } = render(Button, {
			props: { variant: 'ghost' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('text-gray-700');
		expect(button).not.toHaveClass('bg-primary-600');
	});

	it('renders danger variant correctly', () => {
		const { container } = render(Button, {
			props: { variant: 'danger' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('bg-error-600', 'text-white');
	});

	it('renders small size correctly', () => {
		const { container } = render(Button, {
			props: { size: 'sm' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('px-3', 'py-1.5', 'text-sm');
	});

	it('renders medium size correctly', () => {
		const { container } = render(Button, {
			props: { size: 'md' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
	});

	it('renders large size correctly', () => {
		const { container } = render(Button, {
			props: { size: 'lg' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('px-6', 'py-3', 'text-base');
	});

	it('handles disabled state correctly', () => {
		const { container } = render(Button, {
			props: { disabled: true }
		});

		const button = container.querySelector('button');
		expect(button).toBeDisabled();
		expect(button).toHaveClass('disabled:opacity-50', 'disabled:cursor-not-allowed');
	});

	it('handles loading state correctly', () => {
		const { container } = render(Button, {
			props: { loading: true }
		});

		const button = container.querySelector('button');
		expect(button).toBeDisabled(); // Should be disabled when loading
		expect(button).toHaveClass('cursor-wait');
		
		// Check for loading spinner
		const spinner = button?.querySelector('svg');
		expect(spinner).toBeInTheDocument();
		expect(spinner).toHaveClass('animate-spin');
	});

	it('handles fullWidth prop correctly', () => {
		const { container } = render(Button, {
			props: { fullWidth: true }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('w-full');
	});

	it('applies custom className correctly', () => {
		const { container } = render(Button, {
			props: { class: 'custom-class' }
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('custom-class');
	});

	it('handles click events correctly', async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		const { container } = render(Button, {
			props: { onclick: handleClick }
		});

		const button = container.querySelector('button');
		if (button) {
			await user.click(button);
			expect(handleClick).toHaveBeenCalledTimes(1);
		}
	});

	it('does not trigger click when disabled', async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		const { container } = render(Button, {
			props: { 
				disabled: true,
				onclick: handleClick 
			}
		});

		const button = container.querySelector('button');
		if (button) {
			await user.click(button);
			expect(handleClick).not.toHaveBeenCalled();
		}
	});

	it('does not trigger click when loading', async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		const { container } = render(Button, {
			props: { 
				loading: true,
				onclick: handleClick 
			}
		});

		const button = container.querySelector('button');
		if (button) {
			await user.click(button);
			expect(handleClick).not.toHaveBeenCalled();
		}
	});

	it('passes through additional HTML attributes', () => {
		const { container } = render(Button, {
			props: {
				'data-testid': 'custom-button',
				'aria-label': 'Custom aria label'
			}
		});

		const button = container.querySelector('button');
		expect(button).toHaveAttribute('data-testid', 'custom-button');
		expect(button).toHaveAttribute('aria-label', 'Custom aria label');
	});

	it('has proper focus styles', () => {
		const { container } = render(Button, {
			props: {}
		});

		const button = container.querySelector('button');
		expect(button).toHaveClass('focus:outline-none', 'focus:ring-2', 'focus:ring-offset-2');
	});

	it('supports keyboard navigation', async () => {
		const user = userEvent.setup();
		const handleClick = vi.fn();

		const { container } = render(Button, {
			props: { onclick: handleClick }
		});

		const button = container.querySelector('button');
		if (button) {
			// Focus the button and press Enter
			button.focus();
			await user.keyboard('{Enter}');
			expect(handleClick).toHaveBeenCalledTimes(1);

			// Press Space
			await user.keyboard(' ');
			expect(handleClick).toHaveBeenCalledTimes(2);
		}
	});
});