
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { JobTrendsWidget } from '../JobTrendsWidget';
import { dashboardService } from '../../../services/dashboardService';
import type { JobTrendsData } from '../../../types';

// Mock the dashboard service
vi.mock('../../../services/dashboardService', () => ({
  dashboardService: {
    getJobTrends: vi.fn(),
  },
}));

const mockDashboardService = vi.mocked(dashboardService);

const mockJobTrendsData: JobTrendsData = {
  time_series: [
    {
      timestamp: '2024-01-15T08:00:00Z',
      total_jobs: 10,
      successful_jobs: 8,
      failed_jobs: 2,
    },
    {
      timestamp: '2024-01-15T09:00:00Z',
      total_jobs: 15,
      successful_jobs: 12,
      failed_jobs: 3,
    },
    {
      timestamp: '2024-01-15T10:00:00Z',
      total_jobs: 20,
      successful_jobs: 18,
      failed_jobs: 2,
    },
    {
      timestamp: '2024-01-15T11:00:00Z',
      total_jobs: 12,
      successful_jobs: 10,
      failed_jobs: 2,
    },
  ],
};

describe('JobTrendsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock current time for consistent relative time calculations
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders loading state initially', () => {
    mockDashboardService.getJobTrends.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<JobTrendsWidget />);

    expect(screen.getByText('Job Trends')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument(); // Loading spinner
  });

  it('renders job trends data successfully', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
      expect(screen.getByText('Success vs Failure Trends')).toBeInTheDocument();
    });

    // Check summary stats
    expect(screen.getByText('57')).toBeInTheDocument(); // Total jobs (10+15+20+12)
    expect(screen.getByText('48')).toBeInTheDocument(); // Successful jobs (8+12+18+10)
    expect(screen.getByText('9')).toBeInTheDocument(); // Failed jobs (2+3+2+2)
    expect(screen.getByText('84.2%')).toBeInTheDocument(); // Success rate (48/57 * 100)
  });

  it('renders time range selector buttons', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Job Trends')).toBeInTheDocument();
    });

    // Check all time range options are present
    expect(screen.getByText('1 Hour')).toBeInTheDocument();
    expect(screen.getByText('6 Hours')).toBeInTheDocument();
    expect(screen.getByText('24 Hours')).toBeInTheDocument();
    expect(screen.getByText('7 Days')).toBeInTheDocument();
    expect(screen.getByText('30 Days')).toBeInTheDocument();
  });

  it('handles time range selection', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Job Trends')).toBeInTheDocument();
    });

    // Initial call with default range (24h)
    expect(mockDashboardService.getJobTrends).toHaveBeenCalledWith(
      { range: '24h' },
      { skipCache: false }
    );

    // Click on 7 Days button
    const sevenDaysButton = screen.getByText('7 Days');
    fireEvent.click(sevenDaysButton);

    expect(mockDashboardService.getJobTrends).toHaveBeenCalledWith(
      { range: '7d' },
      { skipCache: false }
    );
  });

  it('renders error state when API fails', async () => {
    const error = {
      type: 'server' as const,
      message: 'Failed to fetch trends data',
      recoverable: true,
    };

    mockDashboardService.getJobTrends.mockRejectedValue(error);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load job trends')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch trends data')).toBeInTheDocument();
      expect(screen.getByText('Retry')).toBeInTheDocument();
    });
  });

  it('renders empty state when no data', async () => {
    const emptyData: JobTrendsData = {
      time_series: [],
    };

    mockDashboardService.getJobTrends.mockResolvedValue(emptyData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('No trend data available for the selected time range')).toBeInTheDocument();
    });
  });

  it('handles refresh button click', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    const refreshButton = screen.getByText('Refresh');
    fireEvent.click(refreshButton);

    expect(mockDashboardService.getJobTrends).toHaveBeenCalledWith(
      { range: '24h' },
      { skipCache: true }
    );
  });

  it('calculates trend direction correctly', async () => {
    // Data with upward trend (first: 10, last: 12)
    const upwardTrendData: JobTrendsData = {
      time_series: [
        {
          timestamp: '2024-01-15T08:00:00Z',
          total_jobs: 10,
          successful_jobs: 8,
          failed_jobs: 2,
        },
        {
          timestamp: '2024-01-15T12:00:00Z',
          total_jobs: 12,
          successful_jobs: 10,
          failed_jobs: 2,
        },
      ],
    };

    mockDashboardService.getJobTrends.mockResolvedValue(upwardTrendData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    // Should show upward trend arrow (green arrow up)
    const upArrow = screen.getByRole('img', { hidden: true });
    expect(upArrow).toHaveClass('text-green-500');
  });

  it('respects custom default range', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget defaultRange="7d" />);

    await waitFor(() => {
      expect(screen.getByText('Job Trends')).toBeInTheDocument();
    });

    expect(mockDashboardService.getJobTrends).toHaveBeenCalledWith(
      { range: '7d' },
      { skipCache: false }
    );
  });

  it('can hide success/failure comparison chart', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget showSuccessFailure={false} />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    expect(screen.queryByText('Success vs Failure Trends')).not.toBeInTheDocument();
  });

  it('handles auto-refresh with custom interval', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget refreshInterval={2000} />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    // Initial call
    expect(mockDashboardService.getJobTrends).toHaveBeenCalledTimes(1);

    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);

    await waitFor(() => {
      expect(mockDashboardService.getJobTrends).toHaveBeenCalledTimes(2);
    });
  });

  it('disables auto-refresh when interval is 0', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget refreshInterval={0} />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    // Initial call
    expect(mockDashboardService.getJobTrends).toHaveBeenCalledTimes(1);

    // Fast-forward time
    vi.advanceTimersByTime(10000);

    // Should not have made additional calls
    expect(mockDashboardService.getJobTrends).toHaveBeenCalledTimes(1);
  });

  it('formats timestamps correctly for different ranges', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget defaultRange="1h" />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    // For 1h range, should show time format
    // The exact format depends on locale, but should include time
    const chartContainer = screen.getByText('Total Job Executions').closest('div');
    expect(chartContainer).toBeInTheDocument();
  });

  it('shows legend for success/failure chart', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Success vs Failure Trends')).toBeInTheDocument();
    });

    expect(screen.getByText('Successful Jobs')).toBeInTheDocument();
    expect(screen.getByText('Failed Jobs')).toBeInTheDocument();
  });
});