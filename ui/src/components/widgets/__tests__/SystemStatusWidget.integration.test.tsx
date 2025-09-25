import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SystemStatusWidget } from '../SystemStatusWidget';
import { dashboardService } from '../../../services/dashboardService';
import type { SystemStatus } from '../../../types';

// Mock the dashboard service
vi.mock('../../../services/dashboardService', () => ({
  dashboardService: {
    getSystemStatus: vi.fn(),
  },
}));

const mockDashboardService = vi.mocked(dashboardService);

const mockSystemStatus: SystemStatus = {
  active_workers: 3,
  idle_workers: 2,
  total_jobs_today: 42,
  system_uptime: '2d 14h 32m',
  average_execution_time_24h: 125.5,
  alerts: [
    {
      id: '1',
      type: 'warning',
      message: 'High memory usage detected',
      timestamp: '2024-01-15T10:30:00Z',
    },
  ],
};

describe('SystemStatusWidget - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('displays system status data when loaded successfully', async () => {
    mockDashboardService.getSystemStatus.mockResolvedValue(mockSystemStatus);

    render(<SystemStatusWidget />);

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument(); // Total workers (3 + 2)
    });

    // Check worker status
    expect(screen.getByText('Active: 3')).toBeInTheDocument();
    expect(screen.getByText('Idle: 2')).toBeInTheDocument();

    // Check uptime
    expect(screen.getByText('2d 14h 32m')).toBeInTheDocument();
    expect(screen.getByText('Online')).toBeInTheDocument();

    // Check jobs count
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText('Avg. execution: 2.1m')).toBeInTheDocument();

    // Check alerts
    expect(screen.getByText('System Alerts')).toBeInTheDocument();
    expect(screen.getByText('High memory usage detected')).toBeInTheDocument();
  });

  it('shows no alerts message when there are no alerts', async () => {
    const statusWithoutAlerts: SystemStatus = {
      ...mockSystemStatus,
      alerts: [],
    };
    mockDashboardService.getSystemStatus.mockResolvedValue(statusWithoutAlerts);

    render(<SystemStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('No system alerts')).toBeInTheDocument();
    });
  });

  it('formats execution time correctly for different durations', async () => {
    // Test seconds
    const statusWithSeconds: SystemStatus = {
      ...mockSystemStatus,
      average_execution_time_24h: 30.5,
    };
    mockDashboardService.getSystemStatus.mockResolvedValue(statusWithSeconds);

    const { rerender } = render(<SystemStatusWidget />);

    await waitFor(() => {
      expect(screen.getByText('Avg. execution: 30.5s')).toBeInTheDocument();
    });

    // Test hours
    const statusWithHours: SystemStatus = {
      ...mockSystemStatus,
      average_execution_time_24h: 3665, // 1 hour, 1 minute, 5 seconds
    };
    mockDashboardService.getSystemStatus.mockResolvedValue(statusWithHours);

    rerender(<SystemStatusWidget key="hours" />);

    await waitFor(() => {
      expect(screen.getByText('Avg. execution: 1.0h')).toBeInTheDocument();
    });
  });
});