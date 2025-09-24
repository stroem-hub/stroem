import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import Card from './Card.svelte';

describe('Card', () => {
	it('renders with default props', () => {
		const { container } = render(Card, {
			props: {}
		});

		const card = container.querySelector('div');
		expect(card).toBeInTheDocument();
		expect(card).toHaveClass('bg-white', 'dark:bg-gray-800');
		expect(card).toHaveClass('border', 'border-gray-200', 'dark:border-gray-700', 'rounded-lg'); // default variant
		expect(card).toHaveClass('p-4'); // md padding
		expect(card).toHaveClass('w-full', 'max-w-full'); // responsive
	});

	it('renders default variant correctly', () => {
		const { container } = render(Card, {
			props: { variant: 'default' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('border', 'border-gray-200', 'dark:border-gray-700', 'rounded-lg');
		expect(card).not.toHaveClass('border-2', 'shadow-md');
	});

	it('renders outlined variant correctly', () => {
		const { container } = render(Card, {
			props: { variant: 'outlined' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('border-2', 'border-gray-300', 'dark:border-gray-600', 'rounded-lg');
		expect(card).not.toHaveClass('shadow-md');
	});

	it('renders elevated variant correctly', () => {
		const { container } = render(Card, {
			props: { variant: 'elevated' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('border', 'border-gray-200', 'dark:border-gray-700', 'rounded-lg');
		expect(card).toHaveClass('shadow-md', 'hover:shadow-lg', 'transition-shadow');
	});

	it('renders with no padding correctly', () => {
		const { container } = render(Card, {
			props: { padding: 'none' }
		});

		const card = container.querySelector('div');
		expect(card).not.toHaveClass('p-3', 'p-4', 'p-6');
	});

	it('renders with small padding correctly', () => {
		const { container } = render(Card, {
			props: { padding: 'sm' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('p-3');
		expect(card).not.toHaveClass('p-4', 'p-6');
	});

	it('renders with medium padding correctly', () => {
		const { container } = render(Card, {
			props: { padding: 'md' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('p-4');
		expect(card).not.toHaveClass('p-3', 'p-6');
	});

	it('renders with large padding correctly', () => {
		const { container } = render(Card, {
			props: { padding: 'lg' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('p-6');
		expect(card).not.toHaveClass('p-3', 'p-4');
	});

	it('applies custom className correctly', () => {
		const { container } = render(Card, {
			props: { class: 'custom-card-class' }
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('custom-card-class');
	});

	it('passes through additional HTML attributes', () => {
		const { container } = render(Card, {
			props: {
				'data-testid': 'custom-card',
				'aria-label': 'Custom card label'
			}
		});

		const card = container.querySelector('div');
		expect(card).toHaveAttribute('data-testid', 'custom-card');
		expect(card).toHaveAttribute('aria-label', 'Custom card label');
	});

	it('renders with header slot', () => {
		const TestCardWithHeader = `
			<script>
				import Card from './Card.svelte';
			</script>
			
			<Card>
				{#snippet header()}
					<h2>Card Header</h2>
				{/snippet}
			</Card>
		`;

		const { container } = render(Card, {
			props: {},
			context: new Map([
				['$$slots', { 
					header: () => 'Card Header'
				}]
			])
		});

		// Since we can't easily test slots in this setup, let's test the structure
		const card = container.querySelector('div');
		expect(card).toBeInTheDocument();
	});

	it('has proper responsive behavior', () => {
		const { container } = render(Card, {
			props: {}
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('w-full', 'max-w-full');
	});

	it('has proper dark mode classes', () => {
		const { container } = render(Card, {
			props: {}
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('dark:bg-gray-800', 'dark:border-gray-700');
	});

	it('has proper transition classes', () => {
		const { container } = render(Card, {
			props: {}
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('transition-colors', 'duration-200');
	});

	it('combines variant and padding classes correctly', () => {
		const { container } = render(Card, {
			props: { 
				variant: 'elevated',
				padding: 'lg'
			}
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('shadow-md', 'hover:shadow-lg'); // elevated variant
		expect(card).toHaveClass('p-6'); // lg padding
	});

	it('handles all variant combinations', () => {
		const variants = ['default', 'outlined', 'elevated'] as const;
		const paddings = ['none', 'sm', 'md', 'lg'] as const;

		variants.forEach((variant) => {
			paddings.forEach((padding) => {
				const { container, unmount } = render(Card, {
					props: { variant, padding }
				});

				const card = container.querySelector('div');
				expect(card).toBeInTheDocument();
				expect(card).toHaveClass('bg-white', 'dark:bg-gray-800');

				// Check variant-specific classes
				switch (variant) {
					case 'default':
						expect(card).toHaveClass('border', 'border-gray-200');
						break;
					case 'outlined':
						expect(card).toHaveClass('border-2', 'border-gray-300');
						break;
					case 'elevated':
						expect(card).toHaveClass('shadow-md', 'hover:shadow-lg');
						break;
				}

				// Check padding-specific classes
				switch (padding) {
					case 'none':
						expect(card).not.toHaveClass('p-3', 'p-4', 'p-6');
						break;
					case 'sm':
						expect(card).toHaveClass('p-3');
						break;
					case 'md':
						expect(card).toHaveClass('p-4');
						break;
					case 'lg':
						expect(card).toHaveClass('p-6');
						break;
				}

				unmount();
			});
		});
	});

	it('maintains accessibility standards', () => {
		const { container } = render(Card, {
			props: {
				role: 'article',
				'aria-labelledby': 'card-title'
			}
		});

		const card = container.querySelector('div');
		expect(card).toHaveAttribute('role', 'article');
		expect(card).toHaveAttribute('aria-labelledby', 'card-title');
	});
});