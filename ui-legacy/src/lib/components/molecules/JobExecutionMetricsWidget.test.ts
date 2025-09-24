import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import JobExecutionMetricsWidget from './JobExecutionMetricsWidget.svelte';
import type { JobExecutionMetrics } from '$lib/types';

// Mock data for testing
const mockMetrics: JobExecutionMetrics = {
	today: {
		total_jobs: 142,
		success_count: 135,
		failure_count: 7,
		success_rate: 95.07
	},
	status_distribution: {
		running: 3,
		completed: 135,
		failed: 7,
		queued: 2
	},
	top_failing_workflows: [
		{
			workflow_name: 'data-sync',
			failure_rate: 15.2,
			total_executions: 23
		},
		{
			workflow_name: 'backup-process',
			failure_rate: 8.5,
			total_executions: 47
		}
	],
	average_execution_time: 42.8
};

const mockMetricsNoFailures: JobExecutionMetrics = {
	today: {
		total_jobs: 100,
		success_count: 100,
		failure_count: 0,
		success_rate: 100
	},
	status_distribution: {
		running: 2,
		completed: 98,
		failed: 0,
		queued: 1
	},
	top_failing_workflows: [],
	average_execution_time: 35.2
};

describe('JobExecutionMetricsWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Loading State', () => {
		it('should show skeleton when loading', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					loading: true
				}
			});

			expect(screen.getByRole('region', { name: /loading job execution metrics/i })).toBeInTheDocument();
		});
	});

	describe('Error State', () => {
		it('should show error boundary when error occurs', () => {
			const mockRetry = vi.fn();
			render(JobExecutionMetricsWidget, {
				props: {
					error: 'Failed to load metrics',
					onRetry: mockRetry
				}
			});

			expect(screen.getByText(/failed to load job execution metrics/i)).toBeInTheDocument();
			expect(screen.getByText(/unable to load job execution metrics at this time/i)).toBeInTheDocument();
		});

		it('should call onRetry when retry button is clicked in error state', async () => {
			const mockRetry = vi.fn();
			render(JobExecutionMetricsWidget, {
				props: {
					error: 'Failed to load metrics',
					onRetry: mockRetry
				}
			});

			const retryButton = screen.getByRole('button', { name: /retry/i });
			await fireEvent.click(retryButton);

			expect(mockRetry).toHaveBeenCalledOnce();
		});
	});

	describe('No Data State', () => {
		it('should show unavailable message when no metrics provided', () => {
			const mockRetry = vi.fn();
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: undefined,
					onRetry: mockRetry
				}
			});

			expect(screen.getByText(/job metrics unavailable/i)).toBeInTheDocument();
			expect(screen.getByText(/job execution metrics are not available at this time/i)).toBeInTheDocument();
		});

		it('should call onRetry when retry button is clicked in no data state', async () => {
			const mockRetry = vi.fn();
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: undefined,
					onRetry: mockRetry
				}
			});

			const retryButton = screen.getByRole('button', { name: /retry/i });
			await fireEvent.click(retryButton);

			expect(mockRetry).toHaveBeenCalledOnce();
		});
	});

	describe('Data Display', () => {
		it('should render job execution metrics correctly', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: mockMetrics
				}
			});

			// Check header
			expect(screen.getByText('Job Execution Metrics')).toBeInTheDocument();
			expect(screen.getByText(/today's job performance and execution statistics/i)).toBeInTheDocument();

			// Check today's statistics
			expect(screen.getByText('142')).toBeInTheDocument(); // Total jobs
			expect(screen.getByText('95.1%')).toBeInTheDocument(); // Success rate
			expect(screen.getByText('4.9%')).toBeInTheDocument(); // Failure rate (100 - 95.07)
			expect(screen.getByText('43s')).toBeInTheDocument(); // Average execution time

			// Check status distribution
			expect(screen.getByText('Job Status Distribution')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument(); // Running
			expect(screen.getByText('135')).toBeInTheDocument(); // Completed
			expect(screen.getByText('7')).toBeInTheDocument(); // Failed
			expect(screen.getByText('2')).toBeInTheDocument(); // Queued
		});

		it('should display top failing workflows when present', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: mockMetrics
				}
			});

			expect(screen.getByText('Top Failing Workflows')).toBeInTheDocument();
			expect(screen.getByText('data-sync')).toBeInTheDocument();
			expect(screen.getByText('backup-process')).toBeInTheDocument();
			expect(screen.getByText('15.2%')).toBeInTheDocument();
			expect(screen.getByText('8.5%')).toBeInTheDocument();
			expect(screen.getByText('23 total executions')).toBeInTheDocument();
			expect(screen.getByText('47 total executions')).toBeInTheDocument();
		});

		it('should show positive message when no failing workflows', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: mockMetricsNoFailures
				}
			});

			expect(screen.getByText('All Workflows Performing Well')).toBeInTheDocument();
			expect(screen.getByText(/no workflows with significant failure rates detected/i)).toBeInTheDocument();
		});

		it('should format large numbers with locale formatting', () => {
			const largeMetrics: JobExecutionMetrics = {
				...mockMetrics,
				today: {
					...mockMetrics.today,
					total_jobs: 1234567
				}
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: largeMetrics
				}
			});

			expect(screen.getByText('1,234,567')).toBeInTheDocument();
		});

		it('should format execution times correctly', () => {
			const timeMetrics: JobExecutionMetrics = {
				...mockMetrics,
				average_execution_time: 3665 // 1 hour, 1 minute, 5 seconds
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: timeMetrics
				}
			});

			expect(screen.getByText('1h 1m')).toBeInTheDocument();
		});

		it('should handle zero values gracefully', () => {
			const zeroMetrics: JobExecutionMetrics = {
				today: {
					total_jobs: 0,
					success_count: 0,
					failure_count: 0,
					success_rate: 0
				},
				status_distribution: {
					running: 0,
					completed: 0,
					failed: 0,
					queued: 0
				},
				top_failing_workflows: [],
				average_execution_time: 0
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: zeroMetrics
				}
			});

			expect(screen.getByText('0')).toBeInTheDocument();
			expect(screen.getByText('0.0%')).toBeInTheDocument();
			expect(screen.getByText('0s')).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels and roles', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: mockMetrics
				}
			});

			expect(screen.getByRole('region', { name: /job execution metrics/i })).toBeInTheDocument();
			expect(screen.getByRole('region', { name: /job status distribution/i })).toBeInTheDocument();
			expect(screen.getByRole('region', { name: /top failing workflows/i })).toBeInTheDocument();

			// Check that metric cards have proper article roles
			const articles = screen.getAllByRole('article');
			expect(articles).toHaveLength(4); // Total jobs, success rate, failure rate, avg time

			// Check that each article has a proper labelledby attribute
			articles.forEach(article => {
				expect(article).toHaveAttribute('aria-labelledby');
			});
		});

		it('should have proper heading structure', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: mockMetrics
				}
			});

			const mainHeading = screen.getByRole('heading', { level: 2 });
			expect(mainHeading).toHaveTextContent('Job Execution Metrics');

			const subHeadings = screen.getAllByRole('heading', { level: 3 });
			expect(subHeadings.length).toBeGreaterThan(0);
		});
	});

	describe('Component Props', () => {
		it('should handle undefined metrics gracefully', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					metrics: undefined
				}
			});

			expect(screen.getByText(/job metrics unavailable/i)).toBeInTheDocument();
		});

		it('should handle missing onRetry prop', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					error: 'Test error'
				}
			});

			// Should not show retry button when onRetry is not provided
			expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
		});

		it('should handle loading state correctly', () => {
			render(JobExecutionMetricsWidget, {
				props: {
					loading: true,
					metrics: mockMetrics
				}
			});

			// Should show loading skeleton, not the metrics
			expect(screen.getByRole('region', { name: /loading job execution metrics/i })).toBeInTheDocument();
			expect(screen.queryByText('Job Execution Metrics')).not.toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('should handle metrics with undefined average_execution_time', () => {
			const metricsWithUndefinedTime: JobExecutionMetrics = {
				...mockMetrics,
				average_execution_time: undefined as any
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: metricsWithUndefinedTime
				}
			});

			expect(screen.getByText('N/A')).toBeInTheDocument();
		});

		it('should handle empty top_failing_workflows array', () => {
			const metricsWithNoFailures: JobExecutionMetrics = {
				...mockMetrics,
				top_failing_workflows: []
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: metricsWithNoFailures
				}
			});

			expect(screen.getByText('All Workflows Performing Well')).toBeInTheDocument();
		});

		it('should handle very small execution times', () => {
			const metricsWithSmallTime: JobExecutionMetrics = {
				...mockMetrics,
				average_execution_time: 0.5
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: metricsWithSmallTime
				}
			});

			expect(screen.getByText('1s')).toBeInTheDocument(); // Should round to 1s
		});

		it('should handle very large execution times', () => {
			const metricsWithLargeTime: JobExecutionMetrics = {
				...mockMetrics,
				average_execution_time: 7265 // 2 hours, 1 minute, 5 seconds
			};

			render(JobExecutionMetricsWidget, {
				props: {
					metrics: metricsWithLargeTime
				}
			});

			expect(screen.getByText('2h 1m')).toBeInTheDocument();
		});
	});
});