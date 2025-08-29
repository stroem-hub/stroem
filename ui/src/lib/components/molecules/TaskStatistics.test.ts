import { render, screen } from '@testing-library/svelte';
import { describe, it, expect } from 'vitest';
import TaskStatistics from './TaskStatistics.svelte';
import type { TaskStatistics as TaskStatisticsType } from '$lib/types';

describe('TaskStatistics', () => {
	const mockStatistics: TaskStatisticsType = {
		totalExecutions: 150,
		successRate: 85.5,
		averageDuration: 125.5,
		lastExecution: {
			timestamp: '2024-01-15T10:30:00Z',
			status: 'success',
			triggeredBy: 'user:john.doe',
			duration: 98
		}
	};

	it('renders statistics cards correctly', () => {
		render(TaskStatistics, { statistics: mockStatistics });

		// Check total executions
		expect(screen.getByText('Total Executions')).toBeInTheDocument();
		expect(screen.getByText('150')).toBeInTheDocument();

		// Check success rate
		expect(screen.getByText('Success Rate')).toBeInTheDocument();
		expect(screen.getByText('86%')).toBeInTheDocument();
		expect(screen.getByText('128 of 150 successful')).toBeInTheDocument();

		// Check average duration
		expect(screen.getByText('Average Duration')).toBeInTheDocument();
		expect(screen.getByText('2m 6s')).toBeInTheDocument();
	});

	it('renders last execution information', () => {
		render(TaskStatistics, { statistics: mockStatistics });

		expect(screen.getByText('Last Execution')).toBeInTheDocument();
		expect(screen.getByText('Success')).toBeInTheDocument();
		expect(screen.getByText('user:john.doe')).toBeInTheDocument();
		expect(screen.getByText('1m 38s')).toBeInTheDocument();
	});

	it('handles statistics without last execution', () => {
		const statsWithoutLastExecution: TaskStatisticsType = {
			totalExecutions: 0,
			successRate: 0
		};

		render(TaskStatistics, { statistics: statsWithoutLastExecution });

		expect(screen.getByText('No Executions Yet')).toBeInTheDocument();
		expect(screen.getByText('This task has not been executed yet. Run it to see execution statistics.')).toBeInTheDocument();
	});

	it('displays loading state correctly', () => {
		render(TaskStatistics, { statistics: mockStatistics, loading: true });

		// Should show skeleton loaders
		const skeletonElements = document.querySelectorAll('.animate-pulse');
		expect(skeletonElements.length).toBeGreaterThan(0);
	});

	it('formats duration correctly for different time ranges', () => {
		const testCases = [
			{ duration: 30, expected: '30s' },
			{ duration: 90, expected: '1m 30s' },
			{ duration: 3600, expected: '1h' },
			{ duration: 3720, expected: '1h 2m' }
		];

		testCases.forEach(({ duration, expected }) => {
			const stats: TaskStatisticsType = {
				totalExecutions: 1,
				successRate: 100,
				averageDuration: duration
			};

			const { unmount } = render(TaskStatistics, { statistics: stats });
			expect(screen.getByText(expected)).toBeInTheDocument();
			unmount();
		});
	});

	it('applies correct color coding for success rates', () => {
		const testCases = [
			{ successRate: 95, expectedClass: 'text-green-600' },
			{ successRate: 80, expectedClass: 'text-yellow-600' },
			{ successRate: 50, expectedClass: 'text-red-600' }
		];

		testCases.forEach(({ successRate, expectedClass }) => {
			const stats: TaskStatisticsType = {
				totalExecutions: 100,
				successRate
			};

			const { unmount } = render(TaskStatistics, { statistics: stats });
			const successRateElement = screen.getByText(`${Math.round(successRate)}%`);
			expect(successRateElement).toHaveClass(expectedClass);
			unmount();
		});
	});

	it('handles missing average duration gracefully', () => {
		const statsWithoutDuration: TaskStatisticsType = {
			totalExecutions: 10,
			successRate: 90
		};

		render(TaskStatistics, { statistics: statsWithoutDuration });
		expect(screen.getByText('N/A')).toBeInTheDocument();
	});

	it('formats relative time correctly', () => {
		const now = new Date();
		const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
		
		const stats: TaskStatisticsType = {
			totalExecutions: 1,
			successRate: 100,
			lastExecution: {
				timestamp: oneHourAgo.toISOString(),
				status: 'success',
				triggeredBy: 'system'
			}
		};

		render(TaskStatistics, { statistics: stats });
		expect(screen.getByText('1h ago')).toBeInTheDocument();
	});
});