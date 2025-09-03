import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/svelte';
import RecentActivityWidget from './RecentActivityWidget.svelte';
import type { RecentActivity, RecentJob, UpcomingJob, SystemAlert } from '$lib/types';

// Mock the navigation
const mockGoto = vi.fn();
vi.mock('$app/navigation', () => ({
	goto: mockGoto
}));

describe('RecentActivityWidget', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Mock window.location.href
		Object.defineProperty(window, 'location', {
			value: { href: '' },
			writable: true
		});
	});

	const mockRecentActivity: RecentActivity = {
		recent_jobs: [
			{
				job_id: 'job-123',
				task_name: 'backup-database',
				status: 'success',
				start_time: '2024-01-15T10:25:00Z',
				duration: 120.5,
				triggered_by: 'scheduler:daily'
			},
			{
				job_id: 'job-124',
				task_name: 'sync-data',
				status: 'failed',
				start_time: '2024-01-15T10:20:00Z',
				duration: 45.2,
				triggered_by: 'manual:user123'
			},
			{
				job_id: 'job-125',
				task_name: 'process-queue',
				status: 'running',
				start_time: '2024-01-15T10:30:00Z',
				triggered_by: 'webhook:github'
			}
		],
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
				message: 'Database connection timeout',
				timestamp: '2024-01-15T10:25:00Z',
				source: 'database'
			}
		],
		upcoming_jobs: [
			{
				task_name: 'cleanup-logs',
				scheduled_time: '2024-01-15T12:00:00Z',
				trigger_type: 'cron',
				estimated_duration: 30
			},
			{
				task_name: 'weekly-report',
				scheduled_time: '2024-01-15T14:00:00Z',
				trigger_type: 'schedule'
			}
		]
	};

	it('renders loading state correctly', () => {
		render(RecentActivityWidget, {
			props: {
				loading: true
			}
		});

		expect(screen.getByRole('status', { name: /loading recent activity/i })).toBeInTheDocument();
	});

	it('renders error state correctly', () => {
		const mockRetry = vi.fn();
		render(RecentActivityWidget, {
			props: {
				error: 'Failed to load data',
				onRetry: mockRetry
			}
		});

		expect(screen.getByText('Failed to load recent activity')).toBeInTheDocument();
		expect(screen.getByText('Unable to load recent activity information at this time.')).toBeInTheDocument();
		
		const retryButton = screen.getByRole('button', { name: /retry/i });
		expect(retryButton).toBeInTheDocument();
		
		fireEvent.click(retryButton);
		expect(mockRetry).toHaveBeenCalledOnce();
	});

	it('renders empty state when no data provided', () => {
		render(RecentActivityWidget, {
			props: {}
		});

		expect(screen.getByText('Recent Activity Unavailable')).toBeInTheDocument();
		expect(screen.getByText('Recent activity information is not available at this time.')).toBeInTheDocument();
	});

	it('renders recent activity data correctly', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check main header
		expect(screen.getByText('Recent Activity')).toBeInTheDocument();
		expect(screen.getByText('Real-time feed of job executions, alerts, and upcoming tasks')).toBeInTheDocument();

		// Check system alerts section
		expect(screen.getByText('System Alerts')).toBeInTheDocument();
		expect(screen.getByText('Worker node-02 has been idle for 2 hours')).toBeInTheDocument();
		expect(screen.getByText('Database connection timeout')).toBeInTheDocument();

		// Check recent jobs section
		expect(screen.getByText('Recent Job Executions')).toBeInTheDocument();
		expect(screen.getByText('backup-database')).toBeInTheDocument();
		expect(screen.getByText('sync-data')).toBeInTheDocument();
		expect(screen.getByText('process-queue')).toBeInTheDocument();

		// Check upcoming jobs section
		expect(screen.getByText('Upcoming Scheduled Jobs')).toBeInTheDocument();
		expect(screen.getByText('cleanup-logs')).toBeInTheDocument();
		expect(screen.getByText('weekly-report')).toBeInTheDocument();
	});

	it('displays correct status indicators for jobs', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check status badges
		expect(screen.getByText('Success')).toBeInTheDocument();
		expect(screen.getByText('Failed')).toBeInTheDocument();
		expect(screen.getByText('Running')).toBeInTheDocument();
	});

	it('displays correct alert severity indicators', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check that alerts are displayed with proper severity
		const warningAlert = screen.getByText('Worker node-02 has been idle for 2 hours');
		const errorAlert = screen.getByText('Database connection timeout');
		
		expect(warningAlert).toBeInTheDocument();
		expect(errorAlert).toBeInTheDocument();
	});

	it('formats durations correctly', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check duration formatting
		expect(screen.getByText('Duration: 2m 1s')).toBeInTheDocument(); // 120.5 seconds
		expect(screen.getByText('Duration: 45s')).toBeInTheDocument(); // 45.2 seconds
		expect(screen.getByText('Est. duration: 30s')).toBeInTheDocument(); // 30 seconds
	});

	it('formats triggered_by correctly', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check triggered by formatting
		expect(screen.getByText('Scheduled (daily)')).toBeInTheDocument();
		expect(screen.getByText('Manual (user123)')).toBeInTheDocument();
		expect(screen.getByText('Webhook (github)')).toBeInTheDocument();
	});

	it('navigates to job details when job is clicked', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		const jobElement = screen.getByLabelText('View job details for backup-database');
		fireEvent.click(jobElement);

		expect(window.location.href).toBe('/jobs/job-123');
	});

	it('navigates to task details when upcoming job is clicked', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		const taskElement = screen.getByLabelText('View task details for cleanup-logs');
		fireEvent.click(taskElement);

		expect(window.location.href).toBe('/tasks/cleanup-logs');
	});

	it('handles keyboard navigation for job items', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		const jobElement = screen.getByLabelText('View job details for backup-database');
		fireEvent.keyDown(jobElement, { key: 'Enter' });

		expect(window.location.href).toBe('/jobs/job-123');
	});

	it('displays empty states for sections with no data', () => {
		const emptyActivity: RecentActivity = {
			recent_jobs: [],
			alerts: [],
			upcoming_jobs: []
		};

		render(RecentActivityWidget, {
			props: {
				recentActivity: emptyActivity
			}
		});

		expect(screen.getByText('No Recent Jobs')).toBeInTheDocument();
		expect(screen.getByText('No job executions have been recorded recently.')).toBeInTheDocument();
		expect(screen.getByText('No Upcoming Jobs')).toBeInTheDocument();
		expect(screen.getByText('No jobs are currently scheduled for execution.')).toBeInTheDocument();
	});

	it('does not render alerts section when no alerts present', () => {
		const activityWithoutAlerts: RecentActivity = {
			recent_jobs: mockRecentActivity.recent_jobs,
			alerts: [],
			upcoming_jobs: mockRecentActivity.upcoming_jobs
		};

		render(RecentActivityWidget, {
			props: {
				recentActivity: activityWithoutAlerts
			}
		});

		expect(screen.queryByText('System Alerts')).not.toBeInTheDocument();
	});

	it('displays job IDs in truncated format', () => {
		render(RecentActivityWidget, {
			props: {
				recentActivity: mockRecentActivity
			}
		});

		// Check that job IDs are truncated to first 8 characters
		expect(screen.getByText('ID: job-123...')).toBeInTheDocument();
		expect(screen.getByText('ID: job-124...')).toBeInTheDocument();
	});

	it('handles missing duration gracefully', () => {
		const activityWithMissingDuration: RecentActivity = {
			recent_jobs: [
				{
					job_id: 'job-126',
					task_name: 'test-task',
					status: 'queued',
					start_time: '2024-01-15T10:35:00Z',
					triggered_by: 'api:test'
				}
			],
			alerts: [],
			upcoming_jobs: []
		};

		render(RecentActivityWidget, {
			props: {
				recentActivity: activityWithMissingDuration
			}
		});

		// Should not display duration when not available
		expect(screen.queryByText(/Duration:/)).not.toBeInTheDocument();
	});

	it('handles missing estimated duration gracefully', () => {
		const activityWithMissingEstDuration: RecentActivity = {
			recent_jobs: [],
			alerts: [],
			upcoming_jobs: [
				{
					task_name: 'test-task',
					scheduled_time: '2024-01-15T16:00:00Z',
					trigger_type: 'manual'
				}
			]
		};

		render(RecentActivityWidget, {
			props: {
				recentActivity: activityWithMissingEstDuration
			}
		});

		// Should not display estimated duration when not available
		expect(screen.queryByText(/Est. duration:/)).not.toBeInTheDocument();
	});
});