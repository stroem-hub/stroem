
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
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
  ],
};

describe('JobTrendsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    mockDashboardService.getJobTrends.mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    render(<JobTrendsWidget />);

    expect(screen.getByText('Job Trends')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders job trends data successfully', async () => {
    mockDashboardService.getJobTrends.mockResolvedValue(mockJobTrendsData);

    render(<JobTrendsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Total Job Executions')).toBeInTheDocument();
    });

    // Check summary stats
    expect(screen.getByText('25')).toBeInTheDocument(); // Total jobs (10+15)
    expect(screen.getByText('20')).toBeInTheDocument(); // Successful jobs (8+12)
    expect(screen.getByText('5')).toBeInTheDocument(); // Failed jobs (2+3)
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
});