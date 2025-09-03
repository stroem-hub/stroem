import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import SystemStatusWidget from './SystemStatusWidget.svelte';
import type { SystemStatus, SystemAlert } from '$lib/types';

// Mock system status data
const mockSystemStatus: SystemStatus = {
	active_workers: 3,
	idle_workers: 1,
	total_jobs_today: 142,
	system_uptime: 'P2DT14H30M', // 2 days, 14 hours, 30 minutes
	average_execution_time_24h: 45.2,
	alerts: [
		{
			id: 'alert-001',
			severity: 'warning',
			message: 'Worker node-02 has been idle for 2 hours',
			timestamp: '2024-01-15T10:30:00Z',
			source: 'worker-monitor'
		},
		{
			id: 'alert-002',
			severity: 'error',
			message: 'Database connection timeout detected',
			timestamp: '2024-01-15T11:00:00Z',
			source: 'database-monitor'
		}
	]
};

const mockSystemStatusNoAlerts: SystemStatus = {
	active_workers: 5,
	idle_workers: 2,
	total_jobs_today: 89,
	system_uptime: 'PT6H15M', // 6 hours, 15 minutes
	average_execution_time_24h: 32.1,
	alerts: []
};

describe('SystemStatusWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Loading State', () => {
		it('should display skeleton loader when loading', () => {
			render(SystemStatusWidget, {
				props: {
					loading: true
				}
			});

			// Check for skeleton elements (animate-pulse class indicates skeleton)
			const skeletonElements = document.querySelectorAll('.animate-pulse');
			expect(skeletonElements.length).toBeGreaterThan(0);
		});
	});

	describe('Error State', () => {
		it('should display error boundary when error occurs', () => {
			const mockRetry = vi.fn();
			render(SystemStatusWidget, {
				props: {
					error: 'Failed to load system status',
					onRetry: mockRetry
				}
			});

			expect(screen.getByText('Failed to load system status')).toBeInTheDocument();
			expect(screen.getByText('Unable to load system status information at this time.')).toBeInTheDocument();
		});

		it('should call onRetry when retry button is clicked', async () => {
			const mockRetry = vi.fn();
			render(SystemStatusWidget, {
				props: {
					error: 'Network error',
					onRetry: mockRetry
				}
			});

			const retryButton = screen.getByRole('button', { name: /try again/i });
			await fireEvent.click(retryButton);

			expect(mockRetry).toHaveBeenCalledOnce();
		});
	});

	describe('Empty State', () => {
		it('should display unavailable message when no system status data', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: undefined
				}
			});

			expect(screen.getByText('System Status Unavailable')).toBeInTheDocument();
			expect(screen.getByText('System status information is not available at this time.')).toBeInTheDocument();
		});

		it('should show retry button in empty state when onRetry provided', () => {
			const mockRetry = vi.fn();
			render(SystemStatusWidget, {
				props: {
					systemStatus: undefined,
					onRetry: mockRetry
				}
			});

			const retryButton = screen.getByRole('button', { name: /retry/i });
			expect(retryButton).toBeInTheDocument();
		});
	});

	describe('System Status Display', () => {
		it('should display system status metrics correctly', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Check header
			expect(screen.getByText('System Status')).toBeInTheDocument();
			expect(screen.getByText('Overview of system health and performance metrics')).toBeInTheDocument();

			// Check active workers
			expect(screen.getByText('Active Workers')).toBeInTheDocument();
			expect(screen.getByText('3')).toBeInTheDocument();
			expect(screen.getByText('of 4 total workers')).toBeInTheDocument();
			expect(screen.getByText('• 1 idle')).toBeInTheDocument();

			// Check jobs today
			expect(screen.getByText('Jobs Today')).toBeInTheDocument();
			expect(screen.getByText('142')).toBeInTheDocument();
			expect(screen.getByText('executed since midnight')).toBeInTheDocument();

			// Check system uptime
			expect(screen.getByText('System Uptime')).toBeInTheDocument();
			expect(screen.getByText('2d 14h')).toBeInTheDocument();
			expect(screen.getByText('Avg execution: 45s')).toBeInTheDocument();
		});

		it('should format uptime correctly for different durations', () => {
			const shortUptimeStatus: SystemStatus = {
				...mockSystemStatus,
				system_uptime: 'PT2H30M' // 2 hours, 30 minutes
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: shortUptimeStatus
				}
			});

			expect(screen.getByText('2h 30m')).toBeInTheDocument();
		});

		it('should format execution time correctly', () => {
			const longExecutionStatus: SystemStatus = {
				...mockSystemStatus,
				average_execution_time_24h: 3665 // 1 hour, 1 minute, 5 seconds
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: longExecutionStatus
				}
			});

			expect(screen.getByText('Avg execution: 1h 1m')).toBeInTheDocument();
		});

		it('should handle large job counts with proper formatting', () => {
			const highVolumeStatus: SystemStatus = {
				...mockSystemStatus,
				total_jobs_today: 12345
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: highVolumeStatus
				}
			});

			expect(screen.getByText('12,345')).toBeInTheDocument();
		});
	});

	describe('System Alerts', () => {
		it('should display system alerts when present', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Check alerts section
			expect(screen.getByText('System Alerts')).toBeInTheDocument();
			expect(screen.getByText('2')).toBeInTheDocument(); // Alert count badge

			// Check individual alerts
			expect(screen.getByText('Worker node-02 has been idle for 2 hours')).toBeInTheDocument();
			expect(screen.getByText('Database connection timeout detected')).toBeInTheDocument();
			expect(screen.getByText('Source: worker-monitor')).toBeInTheDocument();
			expect(screen.getByText('Source: database-monitor')).toBeInTheDocument();
		});

		it('should display "All Systems Operational" when no alerts', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatusNoAlerts
				}
			});

			expect(screen.getByText('All Systems Operational')).toBeInTheDocument();
			expect(screen.getByText('No active alerts or warnings detected.')).toBeInTheDocument();
		});

		it('should apply correct styling for different alert severities', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Find alert containers
			const alerts = screen.getAllByRole('alert');
			expect(alerts).toHaveLength(2);

			// Warning alert should have yellow styling
			const warningAlert = alerts.find(alert => 
				alert.textContent?.includes('Worker node-02 has been idle')
			);
			expect(warningAlert).toHaveClass('bg-yellow-50');

			// Error alert should have red styling
			const errorAlert = alerts.find(alert => 
				alert.textContent?.includes('Database connection timeout')
			);
			expect(errorAlert).toHaveClass('bg-red-50');
		});
	});

	describe('Worker Status Colors', () => {
		it('should show green color when workers are active and idle available', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Find the workers card icon container
			const workerCard = screen.getByLabelText('Active Workers').closest('[role="article"]');
			const iconContainer = workerCard?.querySelector('.bg-green-50');
			expect(iconContainer).toBeInTheDocument();
		});

		it('should show red color when no workers are active', () => {
			const noActiveWorkersStatus: SystemStatus = {
				...mockSystemStatus,
				active_workers: 0,
				idle_workers: 3
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: noActiveWorkersStatus
				}
			});

			const workerCard = screen.getByLabelText('Active Workers').closest('[role="article"]');
			const iconContainer = workerCard?.querySelector('.bg-red-50');
			expect(iconContainer).toBeInTheDocument();
		});

		it('should show yellow color when no idle workers available', () => {
			const noIdleWorkersStatus: SystemStatus = {
				...mockSystemStatus,
				active_workers: 4,
				idle_workers: 0
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: noIdleWorkersStatus
				}
			});

			const workerCard = screen.getByLabelText('Active Workers').closest('[role="article"]');
			const iconContainer = workerCard?.querySelector('.bg-yellow-50');
			expect(iconContainer).toBeInTheDocument();
		});
	});

	describe('Accessibility', () => {
		it('should have proper ARIA labels and roles', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Check main region
			expect(screen.getByRole('region', { name: 'System Status Overview' })).toBeInTheDocument();

			// Check metric cards have proper article roles and labels
			expect(screen.getByRole('article', { name: /active workers/i })).toBeInTheDocument();
			expect(screen.getByRole('article', { name: /jobs today/i })).toBeInTheDocument();
			expect(screen.getByRole('article', { name: /system uptime/i })).toBeInTheDocument();

			// Check alerts region
			expect(screen.getByRole('region', { name: 'System Alerts' })).toBeInTheDocument();

			// Check individual alerts have proper alert role
			const alerts = screen.getAllByRole('alert');
			expect(alerts).toHaveLength(2);
		});

		it('should have proper heading structure', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Check heading hierarchy
			const mainHeading = screen.getByRole('heading', { level: 2, name: 'System Status' });
			expect(mainHeading).toBeInTheDocument();

			const alertsHeading = screen.getByRole('heading', { level: 3, name: /system alerts/i });
			expect(alertsHeading).toBeInTheDocument();
		});

		it('should have proper labeling for metric cards', () => {
			render(SystemStatusWidget, {
				props: {
					systemStatus: mockSystemStatus
				}
			});

			// Check that each metric card has proper labeling
			expect(screen.getByLabelText('Active Workers')).toBeInTheDocument();
			expect(screen.getByLabelText('Jobs Today')).toBeInTheDocument();
			expect(screen.getByLabelText('System Uptime')).toBeInTheDocument();
		});
	});

	describe('Edge Cases', () => {
		it('should handle invalid uptime format gracefully', () => {
			const invalidUptimeStatus: SystemStatus = {
				...mockSystemStatus,
				system_uptime: 'invalid-format'
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: invalidUptimeStatus
				}
			});

			expect(screen.getByText('invalid-format')).toBeInTheDocument();
		});

		it('should handle undefined execution time', () => {
			const undefinedExecutionStatus: SystemStatus = {
				...mockSystemStatus,
				average_execution_time_24h: undefined as any
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: undefinedExecutionStatus
				}
			});

			expect(screen.getByText('Avg execution: N/A')).toBeInTheDocument();
		});

		it('should handle alerts without source', () => {
			const alertsWithoutSource: SystemStatus = {
				...mockSystemStatus,
				alerts: [
					{
						id: 'alert-003',
						severity: 'info',
						message: 'System maintenance scheduled',
						timestamp: '2024-01-15T12:00:00Z'
						// No source property
					}
				]
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: alertsWithoutSource
				}
			});

			expect(screen.getByText('System maintenance scheduled')).toBeInTheDocument();
			expect(screen.queryByText('Source:')).not.toBeInTheDocument();
		});

		it('should handle zero workers gracefully', () => {
			const zeroWorkersStatus: SystemStatus = {
				...mockSystemStatus,
				active_workers: 0,
				idle_workers: 0
			};

			render(SystemStatusWidget, {
				props: {
					systemStatus: zeroWorkersStatus
				}
			});

			expect(screen.getByText('0')).toBeInTheDocument();
			expect(screen.getByText('of 0 total workers')).toBeInTheDocument();
			expect(screen.queryByText('idle')).not.toBeInTheDocument();
		});
	});
});