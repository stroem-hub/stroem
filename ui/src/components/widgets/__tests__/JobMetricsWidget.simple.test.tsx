// React import not needed for modern React with JSX transform
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { JobMetricsWidget } from '../JobMetricsWidget';
import { dashboardService } from '../../../services/dashboardService';
import type { JobExecutionMetrics } from '../../../types';

// Mock the dashboard service
vi.mock('../../../services/dashboardService', () => ({
  dashboardService: {
    getJobMetrics: vi.fn(),
  },
}));

const mockJobMetrics: JobExecutionMetrics = {
  today: {
    total_jobs: 150,
    success_count: 142,
    failure_count: 8,
    success_rate: 0.947,
  },
  status_distribution: {
    running: 5,
    completed: 120,
    failed: 8,
    queued: 17,
  },
  top_failing_workflows: [
    {
      name: 'data-processing-pipeline',
      failure_count: 5,
      failure_rate: 0.25,
    },
    {
      name: 'email-notification-service',
      failure_count: 3,
      failure_rate: 0.15,
    },
  ],
  average_execution_time: 245.5,
};

describe('JobMetricsWidget', () => {
  const mockGetJobMetrics = vi.mocked(dashboardService.getJobMetrics);

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetJobMetrics.mockResolvedValue(mockJobMetrics);
  });

  it('renders the widget title', () => {
    render(<JobMetricsWidget />);
    expect(screen.getByText('Job Metrics')).toBeInTheDocument();
  });

  it('displays job metrics data correctly', async () => {
    render(<JobMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText('94.7%')).toBeInTheDocument(); // Success rate
    });

    // Check today's metrics
    expect(screen.getByText('142')).toBeInTheDocument(); // Successful jobs
    expect(screen.getByText('4.1m')).toBeInTheDocument(); // Average execution time (245.5s = 4.1m)

    // Check status distribution section
    expect(screen.getByText('Status Distribution')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Running')).toBeInTheDocument();

    // Check top failing workflows
    expect(screen.getByText('Top Failing Workflows')).toBeInTheDocument();
    expect(screen.getByText('data-processing-pipeline')).toBeInTheDocument();
    expect(screen.getByText('25.0%')).toBeInTheDocument(); // Failure rate
  });

  it('handles workflow click events', async () => {
    const onWorkflowClick = vi.fn();
    render(<JobMetricsWidget onWorkflowClick={onWorkflowClick} />);

    await waitFor(() => {
      expect(screen.getByText('data-processing-pipeline')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('data-processing-pipeline'));
    expect(onWorkflowClick).toHaveBeenCalledWith('data-processing-pipeline');
  });

  it('displays error state when API call fails', async () => {
    const error = {
      type: 'server' as const,
      message: 'Failed to fetch job metrics',
      recoverable: true,
    };
    mockGetJobMetrics.mockRejectedValue(error);

    render(<JobMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load job metrics')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch job metrics')).toBeInTheDocument();
    });
  });

  it('handles refresh functionality', async () => {
    render(<JobMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText('94.7%')).toBeInTheDocument();
    });

    const refreshButton = screen.getByLabelText('Refresh job metrics');
    fireEvent.click(refreshButton);

    expect(mockGetJobMetrics).toHaveBeenCalledWith({ skipCache: true });
  });

  it('displays "no failing workflows" message when list is empty', async () => {
    const metricsWithoutFailures = {
      ...mockJobMetrics,
      top_failing_workflows: [],
    };
    mockGetJobMetrics.mockResolvedValue(metricsWithoutFailures);

    render(<JobMetricsWidget />);

    await waitFor(() => {
      expect(screen.getByText('No failing workflows')).toBeInTheDocument();
    });
  });

  it('calls onError callback when error occurs', async () => {
    const onError = vi.fn();
    const error = {
      type: 'server' as const,
      message: 'Network error',
      recoverable: true,
    };
    mockGetJobMetrics.mockRejectedValue(error);

    render(<JobMetricsWidget onError={onError} />);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(error);
    });
  });
});