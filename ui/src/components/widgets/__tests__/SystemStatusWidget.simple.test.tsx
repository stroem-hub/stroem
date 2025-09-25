import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { SystemStatusWidget } from '../SystemStatusWidget';
import { dashboardService } from '../../../services/dashboardService';

// Mock the dashboard service
vi.mock('../../../services/dashboardService', () => ({
  dashboardService: {
    getSystemStatus: vi.fn(),
  },
}));



const mockDashboardService = vi.mocked(dashboardService);

describe('SystemStatusWidget - Simple Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the widget title', () => {
    mockDashboardService.getSystemStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<SystemStatusWidget />);

    expect(screen.getByText('System Status')).toBeInTheDocument();
  });

  it('shows loading skeletons initially', () => {
    mockDashboardService.getSystemStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<SystemStatusWidget />);

    // Should show skeleton loading states
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders refresh button', () => {
    mockDashboardService.getSystemStatus.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<SystemStatusWidget />);

    const refreshButton = screen.getByLabelText('Refresh system status');
    expect(refreshButton).toBeInTheDocument();
  });
});