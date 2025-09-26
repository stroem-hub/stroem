import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TaskDetail } from '../TaskDetail';
import { taskService } from '../../../services/taskService';
import type { Task, Job, PaginatedResponse } from '../../../types';

// Mock the task service
vi.mock('../../../services/taskService', () => ({
  taskService: {
    getTask: vi.fn(),
    getTaskJobs: vi.fn(),
    executeTask: vi.fn(),
  },
}));

// Mock react-router-dom navigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockTask: Task = {
  id: 'test-task-1',
  name: 'Test Task',
  description: 'A test task for unit testing',
  statistics: {
    total_executions: 10,
    success_count: 8,
    failure_count: 2,
    average_duration: 120,
    last_execution: {
      timestamp: '2024-01-15T10:30:00Z',
      status: 'completed',
      triggered_by: 'manual',
      duration: 95,
    },
  },
  input: {
    param1: {
      id: 'param1',
      required: true,
      description: 'First parameter',
      order: 1,
      type: 'string',
      default: null,
    },
  },
  flow: {
    step1: {
      id: 'step1',
      name: 'First Step',
      action: 'shell',
      input: { command: 'echo "hello"' },
      depends_on: null,
      continue_on_fail: false,
      on_error: null,
    },
  },
};

const mockJobs: PaginatedResponse<Job> = {
  data: [
    {
      id: 'job-1',
      task_name: 'Test Task',
      status: 'completed',
      start_datetime: '2024-01-15T10:30:00Z',
      end_datetime: '2024-01-15T10:31:35Z',
      duration: 95,
      triggered_by: 'manual',
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
};

const renderTaskDetail = (props: Partial<React.ComponentProps<typeof TaskDetail>> = {}) => {
  return render(
    <BrowserRouter>
      <TaskDetail taskId="test-task-1" {...props} />
    </BrowserRouter>
  );
};

describe('TaskDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially', () => {
    vi.mocked(taskService.getTask).mockImplementation(() => new Promise(() => {}));
    vi.mocked(taskService.getTaskJobs).mockImplementation(() => new Promise(() => {}));

    renderTaskDetail();

    // Should show skeleton loading cards
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders task details successfully', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue(mockTask);
    vi.mocked(taskService.getTaskJobs).mockResolvedValue(mockJobs);

    renderTaskDetail();

    await waitFor(() => {
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    expect(screen.getByText('A test task for unit testing')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument(); // Total executions
    expect(screen.getByText('8')).toBeInTheDocument(); // Successful
    expect(screen.getByText('2')).toBeInTheDocument(); // Failed
    expect(screen.getByText('80%')).toBeInTheDocument(); // Success rate
  });

  it('renders task configuration when available', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue(mockTask);
    vi.mocked(taskService.getTaskJobs).mockResolvedValue(mockJobs);

    renderTaskDetail();

    await waitFor(() => {
      expect(screen.getByText('Configuration')).toBeInTheDocument();
    });

    expect(screen.getByText('Input Parameters')).toBeInTheDocument();
    expect(screen.getByText('param1')).toBeInTheDocument();
    expect(screen.getByText('First parameter')).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();

    expect(screen.getByText('Workflow Steps')).toBeInTheDocument();
    expect(screen.getByText('First Step')).toBeInTheDocument();
    expect(screen.getByText('shell')).toBeInTheDocument();
  });

  it('renders execution history', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue(mockTask);
    vi.mocked(taskService.getTaskJobs).mockResolvedValue(mockJobs);

    renderTaskDetail();

    await waitFor(() => {
      expect(screen.getByText('Execution History')).toBeInTheDocument();
    });

    expect(screen.getByText('1 total executions')).toBeInTheDocument();
    expect(screen.getByText('Triggered by manual')).toBeInTheDocument();
  });

  it('handles task not found', async () => {
    vi.mocked(taskService.getTask).mockRejectedValue({
      type: 'server',
      message: 'Task not found',
      recoverable: false,
    });
    vi.mocked(taskService.getTaskJobs).mockResolvedValue(mockJobs);

    renderTaskDetail();

    await waitFor(() => {
      expect(screen.getByText('Failed to load task')).toBeInTheDocument();
    });

    expect(screen.getByText('Task not found')).toBeInTheDocument();
  });

  it('shows execute task button', async () => {
    vi.mocked(taskService.getTask).mockResolvedValue(mockTask);
    vi.mocked(taskService.getTaskJobs).mockResolvedValue(mockJobs);

    renderTaskDetail();

    await waitFor(() => {
      expect(screen.getByText('Execute Task')).toBeInTheDocument();
    });

    const executeButton = screen.getByText('Execute Task');
    expect(executeButton).toBeInTheDocument();
    expect(executeButton).not.toBeDisabled();
  });
});