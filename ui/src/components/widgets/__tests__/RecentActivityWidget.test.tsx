
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RecentActivityWidget } from '../RecentActivityWidget';
import { dashboardService } from '../../../services/dashboardService';
import type { RecentActivity } from '../../../types';

// Mock the dashboard service
vi.mock('../../../services/dashboardService', () => ({
  dashboardService: {
    getRecentActivity: vi.fn(),
  },
}));

const mockDashboardService = vi.mocked(dashboardService);

const mockRecentActivity: RecentActivity = {
  recent_jobs: [
    {
      id: 'job-1',
      task_name: 'test-task-1',
      status: 'completed',
      start_datetime: '2024-01-15T10:00:00Z',
      end_datetime: '2024-01-15T10:05:00Z',
      duration: 300,
      triggered_by: 'user@example.com',
    },
    {
      id: 'job-2',
      task_name: 'test-task-2',
      status: 'failed',
      start_datetime: '2024-01-15T09:30:00Z',
      end_datetime: '2024-01-15T09:35:00Z',
      duration: 300,
      triggered_by: 'scheduler',
    },
    {
      id: 'job-3',
      task_name: 'test-task-3',
      status: 'running',
      start_datetime: '2024-01-15T10:10:00Z',
      triggered_by: 'api',
    },
  ],
  recent_alerts: [
    {
      id: 'alert-1',
      type: 'warning',
      message: 'High memory usage detected',
      timestamp: '2024-01-15T10:15:00Z',
    },
    {
      id: 'alert-2',
      type: 'error',
      message: 'Database connection failed',
      timestamp: '2024-01-15T10:05:00Z',
    },
  ],
};

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current time for consistent relative time calculations
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T10:20:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    mockDashboardService.getRecentActivity.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<RecentActivityWidget />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('renders recent activity data successfully', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    }, { timeout: 10000 });

    await waitFor(() => {
      expect(screen.getByText('Recent Alerts')).toBeInTheDocument();
    });

    // Check jobs are displayed
    expect(screen.getByText('test-task-1')).toBeInTheDocument();
    expect(screen.getByText('test-task-2')).toBeInTheDocument();
    expect(screen.getByText('test-task-3')).toBeInTheDocument();

    // Check job statuses
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.getByText('running')).toBeInTheDocument();

    // Check alerts are displayed
    expect(screen.getByText('High memory usage detected')).toBeInTheDocument();
    expect(screen.getByText('Database connection failed')).toBeInTheDocument();

    // Check alert types
    expect(screen.getByText('warning')).toBeInTheDocument();
    expect(screen.getByText('error')).toBeInTheDocument();
  });

  it('renders empty state when no activity', async () => {
    const emptyActivity: RecentActivity = {
      recent_jobs: [],
      recent_alerts: [],
    };

    mockDashboardService.getRecentActivity.mockResolvedValue(emptyActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('No recent activity')).toBeInTheDocument();
    });
  });

  it('renders error state when API fails', async () => {
    const error = {
      type: 'server' as const,
      message: 'Failed to fetch data',
      recoverable: true,
    };

    mockDashboardService.getRecentActivity.mockRejectedValue(error);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load recent activity')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch data')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockDashboardService.getRecentActivity).toHaveBeenCalledWith({ skipCache: true });
  });

  it('respects maxItems prop', async () => {
    const manyJobsActivity: RecentActivity = {
      recent_jobs: Array.from({ length: 20 }, (_, i) => ({
        id: `job-${i}`,
        task_name: `task-${i}`,
        status: 'completed' as const,
        start_datetime: '2024-01-15T10:00:00Z',
        triggered_by: 'test',
      })),
      recent_alerts: [],
    };

    mockDashboardService.getRecentActivity.mockResolvedValue(manyJobsActivity);

    render(<RecentActivityWidget maxItems={5} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    // Should only show 5 jobs
    expect(screen.getByText('task-0')).toBeInTheDocument();
    expect(screen.getByText('task-4')).toBeInTheDocument();
    expect(screen.queryByText('task-5')).not.toBeInTheDocument();
  });

  it('formats relative time correctly', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    // Job started 20 minutes ago (10:00 vs current 10:20)
    expect(screen.getByText('20m ago')).toBeInTheDocument();
    // Job started 50 minutes ago (09:30 vs current 10:20)
    expect(screen.getByText('50m ago')).toBeInTheDocument();
    // Job started 10 minutes ago (10:10 vs current 10:20)
    expect(screen.getByText('10m ago')).toBeInTheDocument();
  });

  it('displays job duration when available', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    // Should show duration for completed/failed jobs
    expect(screen.getAllByText('Duration: 300s')).toHaveLength(2);
  });

  it('handles auto-refresh with custom interval', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget refreshInterval={1000} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    // Initial call
    expect(mockDashboardService.getRecentActivity).toHaveBeenCalledTimes(1);

    // Fast-forward 1 second
    vi.advanceTimersByTime(1000);

    await waitFor(() => {
      expect(mockDashboardService.getRecentActivity).toHaveBeenCalledTimes(2);
    });
  });

  it('disables auto-refresh when interval is 0', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget refreshInterval={0} />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    // Initial call
    expect(mockDashboardService.getRecentActivity).toHaveBeenCalledTimes(1);

    // Fast-forward time
    vi.advanceTimersByTime(10000);

    // Should not have made additional calls
    expect(mockDashboardService.getRecentActivity).toHaveBeenCalledTimes(1);
  });
});