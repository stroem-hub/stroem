import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import '@testing-library/jest-dom';
import JobExecutionTrendsWidget from './JobExecutionTrendsWidget.svelte';
import type { JobTrendsData } from '$lib/types';

// Mock Chart.js
vi.mock('chart.js', () => ({
	Chart: vi.fn().mockImplementation(() => ({
		destroy: vi.fn(),
		update: vi.fn()
	})),
	registerables: []
}));

describe('JobExecutionTrendsWidget', () => {
	const mockTrendsData: JobTrendsData = {
		time_series: [
			{
				timestamp: '2024-01-15T08:00:00Z',
				total_jobs: 10,
				successful_jobs: 8,
				failed_jobs: 2
			},
			{
				timestamp: '2024-01-15T09:00:00Z',
				total_jobs: 15,
				successful_jobs: 12,
				failed_jobs: 3
			},
			{
				timestamp: '2024-01-15T10:00:00Z',
				total_jobs: 8,
				successful_jobs: 7,
				failed_jobs: 1
			}
		],
		time_range: '24h'
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('renders loading state correctly', () => {
		render(JobExecutionTrendsWidget, {
			props: {
				loading: true
			}
		});

		// Check for loading skeleton elements
		expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
	});

	it('renders error state correctly', () => {
		const mockRetry = vi.fn();
		render(JobExecutionTrendsWidget, {
			props: {
				error: 'Failed to load trends data',
				onRetry: mockRetry
			}
		});

		expect(screen.getByText('Failed to load job trends')).toBeInTheDocument();
		expect(screen.getByText('Unable to load job execution trends data at this time.')).toBeInTheDocument();
		
		const retryButton = screen.getByRole('button', { name: /retry/i });
		expect(retryButton).toBeInTheDocument();
		
		fireEvent.click(retryButton);
		expect(mockRetry).toHaveBeenCalledOnce();
	});

	it('renders empty state when no data is provided', () => {
		const mockRetry = vi.fn();
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: undefined,
				onRetry: mockRetry
			}
		});

		expect(screen.getByText('No Trends Data')).toBeInTheDocument();
		expect(screen.getByText('No job execution trends data is available for the selected time range.')).toBeInTheDocument();
	});

	it('renders empty state when trends data has no time series', () => {
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: {
					time_series: [],
					time_range: '24h'
				}
			}
		});

		expect(screen.getByText('No Trends Data')).toBeInTheDocument();
	});

	it('renders trends data correctly', () => {
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: mockTrendsData
			}
		});

		// Check header
		expect(screen.getByText('Job Execution Trends')).toBeInTheDocument();
		expect(screen.getByText('Historical job execution patterns and success rates over time')).toBeInTheDocument();

		// Check time range selector
		expect(screen.getByRole('button', { name: '1 Hour' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '24 Hours' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '7 Days' })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: '30 Days' })).toBeInTheDocument();

		// Check that 24 Hours is selected (matches mockTrendsData.time_range)
		const selectedButton = screen.getByRole('button', { name: '24 Hours' });
		expect(selectedButton).toHaveClass('bg-blue-600');

		// Check chart canvas
		expect(screen.getByRole('img', { name: /job execution trends chart/i })).toBeInTheDocument();

		// Check summary statistics
		expect(screen.getByText('Total Jobs')).toBeInTheDocument();
		expect(screen.getByText('Avg Success Rate')).toBeInTheDocument();
		expect(screen.getByText('Peak Jobs')).toBeInTheDocument();
		expect(screen.getByText('Trend')).toBeInTheDocument();
	});

	it('calculates summary statistics correctly', () => {
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: mockTrendsData
			}
		});

		// Total jobs: 10 + 15 + 8 = 33
		expect(screen.getByText('33')).toBeInTheDocument();

		// Success rate: (8 + 12 + 7) / (10 + 15 + 8) = 27/33 = 81.8%
		expect(screen.getByText('81.8%')).toBeInTheDocument();

		// Peak jobs: max(10, 15, 8) = 15
		expect(screen.getByText('15')).toBeInTheDocument();
	});

	it('handles time range selection', async () => {
		const mockTimeRangeChange = vi.fn();
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: mockTrendsData,
				onTimeRangeChange: mockTimeRangeChange
			}
		});

		const sevenDaysButton = screen.getByRole('button', { name: '7 Days' });
		fireEvent.click(sevenDaysButton);

		expect(mockTimeRangeChange).toHaveBeenCalledWith('7d');
	});

	it('updates selected time range when trendsData changes', async () => {
		const { rerender } = render(JobExecutionTrendsWidget, {
			props: {
				trendsData: mockTrendsData
			}
		});

		// Initially 24h should be selected
		expect(screen.getByRole('button', { name: '24 Hours' })).toHaveClass('bg-blue-600');

		// Update with new time range
		const newTrendsData: JobTrendsData = {
			...mockTrendsData,
			time_range: '7d'
		};

		await rerender({
			trendsData: newTrendsData
		});

		// Now 7 Days should be selected
		expect(screen.getByRole('button', { name: '7 Days' })).toHaveClass('bg-blue-600');
		expect(screen.getByRole('button', { name: '24 Hours' })).not.toHaveClass('bg-blue-600');
	});

	it('has proper accessibility attributes', () => {
		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: mockTrendsData
			}
		});

		// Check main region
		expect(screen.getByRole('region', { name: 'Job Execution Trends' })).toBeInTheDocument();

		// Check time range selector
		expect(screen.getByRole('tablist', { name: 'Time range selection' })).toBeInTheDocument();
		
		const timeRangeButtons = screen.getAllByRole('tab');
		timeRangeButtons.forEach(button => {
			expect(button).toHaveAttribute('aria-controls', 'trends-chart');
			expect(button).toHaveAttribute('aria-selected');
		});

		// Check chart
		const chart = screen.getByRole('img', { name: /job execution trends chart/i });
		expect(chart).toHaveAttribute('id', 'trends-chart');
	});

	it('handles empty summary statistics correctly', () => {
		const emptyTrendsData: JobTrendsData = {
			time_series: [],
			time_range: '24h'
		};

		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: emptyTrendsData
			}
		});

		// Should show empty state, not crash
		expect(screen.getByText('No Trends Data')).toBeInTheDocument();
	});

	it('calculates trend correctly', () => {
		// Create data with clear upward trend
		const trendingUpData: JobTrendsData = {
			time_series: [
				{ timestamp: '2024-01-15T08:00:00Z', total_jobs: 5, successful_jobs: 4, failed_jobs: 1 },
				{ timestamp: '2024-01-15T09:00:00Z', total_jobs: 6, successful_jobs: 5, failed_jobs: 1 },
				{ timestamp: '2024-01-15T10:00:00Z', total_jobs: 15, successful_jobs: 12, failed_jobs: 3 },
				{ timestamp: '2024-01-15T11:00:00Z', total_jobs: 20, successful_jobs: 18, failed_jobs: 2 }
			],
			time_range: '24h'
		};

		render(JobExecutionTrendsWidget, {
			props: {
				trendsData: trendingUpData
			}
		});

		// Should show rising trend
		expect(screen.getByText('Rising')).toBeInTheDocument();
		expect(screen.getByText('↗')).toBeInTheDocument();
	});
});