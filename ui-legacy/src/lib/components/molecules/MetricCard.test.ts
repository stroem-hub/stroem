import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import MetricCard from './MetricCard.svelte';

describe('MetricCard', () => {
	it('renders basic metric card with title and value', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Total Jobs',
				value: 1234
			}
		});

		expect(container.textContent).toContain('Total Jobs');
		expect(container.textContent).toContain('1,234');
	});

	it('renders string values without formatting', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Status',
				value: 'Healthy'
			}
		});

		expect(container.textContent).toContain('Status');
		expect(container.textContent).toContain('Healthy');
	});

	it('displays loading state', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Total Jobs',
				value: 1234,
				loading: true
			}
		});

		// Should show loading skeleton instead of content
		expect(container.textContent).not.toContain('Total Jobs');
		expect(container.textContent).not.toContain('1,234');
		expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
	});

	it('displays positive change indicator', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Total Jobs',
				value: 1234,
				change: {
					value: 12.5,
					type: 'increase',
					period: 'last week'
				}
			}
		});

		expect(container.textContent).toContain('+12.5%');
		expect(container.textContent).toContain('from last week');
	});

	it('displays negative change indicator', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Total Jobs',
				value: 1234,
				change: {
					value: -8.3,
					type: 'decrease',
					period: 'last month'
				}
			}
		});

		expect(container.textContent).toContain('-8.3%');
		expect(container.textContent).toContain('from last month');
	});

	it('applies correct color classes', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Total Jobs',
				value: 1234,
				color: 'green'
			}
		});

		const card = container.querySelector('div');
		expect(card).toHaveClass('bg-green-50');
		expect(card).toHaveClass('border-green-200');
	});

	it('handles different color variants', () => {
		const colors = ['blue', 'green', 'yellow', 'red'] as const;
		
		colors.forEach(color => {
			const { container } = render(MetricCard, {
				props: {
					title: 'Test',
					value: 100,
					color
				}
			});

			const card = container.querySelector('div');
			expect(card).toHaveClass(`bg-${color}-50`);
			expect(card).toHaveClass(`border-${color}-200`);
		});
	});

	it('formats large numbers with locale formatting', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Large Number',
				value: 1234567
			}
		});

		expect(container.textContent).toContain('1,234,567');
	});

	it('handles zero values correctly', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Zero Value',
				value: 0
			}
		});

		expect(container.textContent).toContain('0');
	});

	it('handles change value with absolute value display', () => {
		const { container } = render(MetricCard, {
			props: {
				title: 'Test',
				value: 100,
				change: {
					value: -15.7,
					type: 'decrease',
					period: 'yesterday'
				}
			}
		});

		// Should display absolute value
		expect(container.textContent).toContain('-15.7%');
	});
});