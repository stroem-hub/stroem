
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
  ],
  recent_alerts: [
    {
      id: 'alert-1',
      type: 'warning',
      message: 'High memory usage detected',
      timestamp: '2024-01-15T10:15:00Z',
    },
  ],
};

describe('RecentActivityWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockDashboardService.getRecentActivity.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<RecentActivityWidget />);

    expect(screen.getByText('Recent Activity')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders recent activity data successfully', async () => {
    mockDashboardService.getRecentActivity.mockResolvedValue(mockRecentActivity);

    render(<RecentActivityWidget />);

    await waitFor(() => {
      expect(screen.getByText('Recent Jobs')).toBeInTheDocument();
    });

    expect(screen.getByText('test-task-1')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('High memory usage detected')).toBeInTheDocument();
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
});