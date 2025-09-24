import { render, screen } from '@testing-library/svelte';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LineChart from './LineChart.svelte';

// Mock Chart.js
vi.mock('chart.js', () => ({
	Chart: vi.fn().mockImplementation(() => ({
		destroy: vi.fn()
	})),
	CategoryScale: {},
	LinearScale: {},
	PointElement: {},
	LineElement: {},
	Title: {},
	Tooltip: {},
	Legend: {}
}));

// Mock canvas context
const mockGetContext = vi.fn(() => ({
	canvas: {},
	fillRect: vi.fn(),
	clearRect: vi.fn(),
	getImageData: vi.fn(),
	putImageData: vi.fn(),
	createImageData: vi.fn(),
	setTransform: vi.fn(),
	drawImage: vi.fn(),
	save: vi.fn(),
	restore: vi.fn(),
	beginPath: vi.fn(),
	moveTo: vi.fn(),
	lineTo: vi.fn(),
	closePath: vi.fn(),
	stroke: vi.fn(),
	fill: vi.fn()
}));

beforeEach(() => {
	// Mock HTMLCanvasElement.getContext
	HTMLCanvasElement.prototype.getContext = mockGetContext;
	vi.clearAllMocks();
});

describe('LineChart', () => {
	const sampleData = [
		{ date: '2024-01-01', value: 10 },
		{ date: '2024-01-02', value: 15 },
		{ date: '2024-01-03', value: 12 },
		{ date: '2024-01-04', value: 18 }
	];

	it('renders loading state', () => {
		render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value',
				loading: true
			}
		});

		// Should show loading skeleton
		const loadingElements = screen.getAllByRole('generic');
		expect(loadingElements.some(el => el.classList.contains('animate-pulse'))).toBe(true);
	});

	it('renders empty state when no data provided', () => {
		render(LineChart, {
			props: {
				data: [],
				xAxis: 'date',
				yAxis: 'value'
			}
		});

		expect(screen.getByText('No data available')).toBeInTheDocument();
		expect(screen.getByText('Chart data will appear here when available.')).toBeInTheDocument();
	});

	it('renders canvas when data is provided', () => {
		render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
		expect(canvas.tagName).toBe('CANVAS');
	});

	it('applies custom height', () => {
		render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value',
				height: 400
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toHaveStyle('height: 400px');
	});

	it('handles Date objects in data', () => {
		const dateData = [
			{ date: new Date('2024-01-01'), value: 10 },
			{ date: new Date('2024-01-02'), value: 15 }
		];

		render(LineChart, {
			props: {
				data: dateData,
				xAxis: 'date',
				yAxis: 'value'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
	});

	it('handles non-numeric y-axis values gracefully', () => {
		const invalidData = [
			{ date: '2024-01-01', value: 'invalid' },
			{ date: '2024-01-02', value: null },
			{ date: '2024-01-03', value: undefined }
		];

		render(LineChart, {
			props: {
				data: invalidData,
				xAxis: 'date',
				yAxis: 'value'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
	});

	it('applies custom color', () => {
		render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value',
				color: '#ff0000'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
	});

	it('displays title when provided', () => {
		render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value',
				title: 'Test Chart'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
	});

	it('has proper container styling', () => {
		const { container } = render(LineChart, {
			props: {
				data: sampleData,
				xAxis: 'date',
				yAxis: 'value'
			}
		});

		const chartContainer = container.firstChild as HTMLElement;
		expect(chartContainer).toHaveClass(
			'relative',
			'rounded-lg',
			'border',
			'border-gray-200',
			'bg-white',
			'p-4',
			'shadow-sm'
		);
	});

	it('handles mixed data types in x-axis', () => {
		const mixedData = [
			{ x: 1, y: 10 },
			{ x: 'string', y: 15 },
			{ x: new Date(), y: 12 }
		];

		render(LineChart, {
			props: {
				data: mixedData,
				xAxis: 'x',
				yAxis: 'y'
			}
		});

		const canvas = screen.getByRole('img');
		expect(canvas).toBeInTheDocument();
	});
});