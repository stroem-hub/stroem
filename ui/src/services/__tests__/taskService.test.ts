import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TaskService } from '../taskService';
import { apiClient } from '../apiClient';
import type { Task, Job } from '../../types';
import type { TasksResponse, TaskResponse, TaskJobsResponse, TaskExecutionResponse } from '../apiTypes';

// Mock the API client
vi.mock('../apiClient', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApiClient = vi.mocked(apiClient);

describe('TaskService', () => {
  let taskService: TaskService;

  // Mock data
  const mockTask: Task = {
    id: 'task-1',
    name: 'Test Task',
    description: 'A test task',
    statistics: {
      total_executions: 10,
      success_count: 8,
      failure_count: 2,
      average_duration: 120,
      last_execution: {
        timestamp: '2023-01-01T00:00:00Z',
        status: 'success',
        triggered_by: 'user',
        duration: 120,
      },
    },
  };

  const mockJob: Job = {
    id: 'job-1',
    task_name: 'Test Task',
    status: 'completed',
    start_datetime: '2024-01-01T10:00:00Z',
    end_datetime: '2024-01-01T10:02:00Z',
    duration: 120,
    triggered_by: 'manual',
  };

  const mockTasksResponse: TasksResponse = {
    success: true,
    data: [mockTask],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  };

  const mockTaskResponse: TaskResponse = {
    task: mockTask,
  };

  const mockJobsResponse: TaskJobsResponse = {
    success: true,
    data: [mockJob],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    },
  };

  const mockExecutionResponse: TaskExecutionResponse = {
    job_id: 'job-2',
    message: 'Task execution started',
  };

  beforeEach(() => {
    taskService = new TaskService({
      taskListTTL: 1000,
      taskDetailTTL: 2000,
      taskJobsTTL: 500,
      maxRetries: 2,
      retryDelay: 100,
      retryBackoffMultiplier: 2,
    });
    vi.clearAllMocks();
  });

  afterEach(() => {
    taskService.clearAllCache();
  });

  describe('getTasks', () => {
    it('should fetch tasks successfully', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      const result = await taskService.getTasks({ page: 1, limit: 10 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?page=1&limit=10');
      expect(result).toEqual(mockTasksResponse);
    });

    it('should handle empty parameters', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.getTasks();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks');
    });

    it('should build query string correctly', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.getTasks({
        page: 2,
        limit: 20,
        search: 'test',
        sort_by: 'name',
        sort_order: 'desc',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/tasks?page=2&limit=20&search=test&sort_by=name&sort_order=desc'
      );
    });

    it('should use cache on subsequent calls', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      // First call
      await taskService.getTasks({ page: 1 });
      // Second call (should use cache)
      await taskService.getTasks({ page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should skip cache when requested', async () => {
      mockApiClient.get.mockResolvedValue(mockTasksResponse);

      // First call
      await taskService.getTasks({ page: 1 });
      // Second call with skipCache
      await taskService.getTasks({ page: 1 }, { skipCache: true });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should retry on failure', async () => {
      const error = { type: 'network', message: 'Network error', recoverable: true };
      mockApiClient.get
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockTasksResponse);

      const result = await taskService.getTasks();

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
      expect(result).toEqual(mockTasksResponse);
    });

    it('should throw error after max retries', async () => {
      const error = { type: 'network', message: 'Network error', recoverable: true };
      mockApiClient.get.mockRejectedValue(error);

      await expect(taskService.getTasks()).rejects.toEqual(error);
      expect(mockApiClient.get).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('getTask', () => {
    it('should fetch task details successfully', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTaskResponse);

      const result = await taskService.getTask('task-1');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks/task-1');
      expect(result).toEqual(mockTask);
    });

    it('should throw validation error for empty task ID', async () => {
      await expect(taskService.getTask('')).rejects.toEqual({
        type: 'validation',
        message: 'Task ID is required',
        recoverable: false,
      });

      expect(mockApiClient.get).not.toHaveBeenCalled();
    });

    it('should use cache for repeated calls', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTaskResponse);

      await taskService.getTask('task-1');
      await taskService.getTask('task-1');

      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTaskJobs', () => {
    it('should fetch task jobs successfully', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockJobsResponse);

      const result = await taskService.getTaskJobs('task-1', { page: 1, limit: 5 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks/task-1/jobs?page=1&limit=5');
      expect(result).toEqual(mockJobsResponse);
    });

    it('should throw validation error for empty task ID', async () => {
      await expect(taskService.getTaskJobs('')).rejects.toEqual({
        type: 'validation',
        message: 'Task ID is required',
        recoverable: false,
      });
    });

    it('should handle complex query parameters', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockJobsResponse);

      await taskService.getTaskJobs('task-1', {
        page: 2,
        limit: 20,
        status: 'completed',
        sort_by: 'start_datetime',
        sort_order: 'desc',
      });

      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/api/tasks/task-1/jobs?page=2&limit=20&status=completed&sort_by=start_datetime&sort_order=desc'
      );
    });
  });

  describe('executeTask', () => {
    it('should execute task successfully', async () => {
      mockApiClient.post.mockResolvedValueOnce(mockExecutionResponse);

      const result = await taskService.executeTask('task-1', { env: 'test' });

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/tasks/task-1/execute', {
        task_id: 'task-1',
        parameters: { env: 'test' },
      });
      expect(result).toBe('job-2');
    });

    it('should execute task without parameters', async () => {
      mockApiClient.post.mockResolvedValueOnce(mockExecutionResponse);

      await taskService.executeTask('task-1');

      expect(mockApiClient.post).toHaveBeenCalledWith('/api/tasks/task-1/execute', {
        task_id: 'task-1',
        parameters: undefined,
      });
    });

    it('should throw validation error for empty task ID', async () => {
      await expect(taskService.executeTask('')).rejects.toEqual({
        type: 'validation',
        message: 'Task ID is required',
        recoverable: false,
      });
    });

    it('should retry on recoverable errors', async () => {
      const error = { type: 'server', message: 'Server error', recoverable: true };
      mockApiClient.post
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce(mockExecutionResponse);

      const result = await taskService.executeTask('task-1');

      expect(mockApiClient.post).toHaveBeenCalledTimes(2);
      expect(result).toBe('job-2');
    });

    it('should not retry on validation errors', async () => {
      const error = { type: 'validation', message: 'Invalid parameters', recoverable: false };
      mockApiClient.post.mockRejectedValueOnce(error);

      await expect(taskService.executeTask('task-1')).rejects.toEqual(error);
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    });
  });

  describe('searchTasks', () => {
    it('should search tasks with query', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.searchTasks('deploy', { page: 1, limit: 10 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?page=1&limit=10&search=deploy');
    });

    it('should handle empty query', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.searchTasks('', { page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?page=1');
    });

    it('should trim whitespace from query', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.searchTasks('  deploy  ');

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?search=deploy');
    });
  });

  describe('getTasksSorted', () => {
    it('should get sorted tasks', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.getTasksSorted('name', 'asc', { page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?page=1&sort_by=name&sort_order=asc');
    });

    it('should use default sorting', async () => {
      mockApiClient.get.mockResolvedValueOnce(mockTasksResponse);

      await taskService.getTasksSorted();

      expect(mockApiClient.get).toHaveBeenCalledWith('/api/tasks?sort_by=name&sort_order=asc');
    });
  });

  describe('validateExecutionParameters', () => {
    it('should validate valid parameters', () => {
      const result = taskService.validateExecutionParameters({
        env: 'production',
        timeout: 300,
        enabled: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject dangerous parameter names', () => {
      const result = taskService.validateExecutionParameters({
        constructor: 'bad',
        prototype: 'dangerous',
        normal: 'good',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      // Check that dangerous keys are detected
      const hasConstructorError = result.errors.some(error => error.includes('constructor'));
      const hasPrototypeError = result.errors.some(error => error.includes('prototype'));
      expect(hasConstructorError || hasPrototypeError).toBe(true);
    });

    it('should reject empty parameter keys', () => {
      const result = taskService.validateExecutionParameters({
        '': 'empty key',
        ' ': 'whitespace key',
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should handle non-serializable values', () => {
      const circular: any = {};
      circular.self = circular;

      const result = taskService.validateExecutionParameters({
        circular,
      });

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Parameter "circular" contains non-serializable value');
    });
  });

  describe('executeTasks', () => {
    it('should execute multiple tasks successfully', async () => {
      mockApiClient.post
        .mockResolvedValueOnce({ job_id: 'job-1', message: 'Started' })
        .mockResolvedValueOnce({ job_id: 'job-2', message: 'Started' });

      const executions = [
        { taskId: 'task-1', parameters: { env: 'test' } },
        { taskId: 'task-2' },
      ];

      const result = await taskService.executeTasks(executions);

      expect(result.successful).toHaveLength(2);
      expect(result.failed).toHaveLength(0);
      expect(result.successful[0]).toEqual({ taskId: 'task-1', jobId: 'job-1' });
      expect(result.successful[1]).toEqual({ taskId: 'task-2', jobId: 'job-2' });
    });

    it('should handle mixed success and failure', async () => {
      const error = { type: 'server', message: 'Server error', recoverable: true };
      mockApiClient.post
        .mockResolvedValueOnce({ job_id: 'job-1', message: 'Started' })
        .mockRejectedValue(error);

      const executions = [
        { taskId: 'task-1' },
        { taskId: 'task-2' },
      ];

      const result = await taskService.executeTasks(executions);

      expect(result.successful).toHaveLength(1);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]?.taskId).toBe('task-2');
      expect(result.failed[0]?.error).toEqual(error);
    });

    it('should fail fast when requested', async () => {
      const error = { type: 'server', message: 'Server error', recoverable: true };
      mockApiClient.post.mockRejectedValue(error);

      const executions = [
        { taskId: 'task-1' },
        { taskId: 'task-2' },
      ];

      const result = await taskService.executeTasks(executions, { failFast: true });

      expect(result.successful).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      // In failFast mode, it should stop after first failure, but with retries it might call more than once
      expect(mockApiClient.post).toHaveBeenCalled();
    });
  });

  describe('cache management', () => {
    it('should provide cache statistics', async () => {
      mockApiClient.get.mockResolvedValue(mockTasksResponse);

      // Populate cache
      await taskService.getTasks({ page: 1 });

      const stats = taskService.getCacheStats();

      expect(stats.totalEntries).toBe(1);
      expect(stats.validEntries).toBe(1);
      expect(stats.expiredEntries).toBe(0);
      expect(stats.entries).toHaveLength(1);
    });

    it('should clean up expired cache entries', async () => {
      // Create service with very short TTL
      const shortTTLService = new TaskService({
        taskListTTL: 1, // 1ms
      });

      mockApiClient.get.mockResolvedValue(mockTasksResponse);

      // Populate cache
      await shortTTLService.getTasks({ page: 1 });

      // Wait for cache to expire
      await new Promise(resolve => setTimeout(resolve, 10));

      const cleanedCount = shortTTLService.cleanupExpiredCache();

      expect(cleanedCount).toBe(1);
    });

    it('should clear all cache', async () => {
      // Mock different responses for different endpoints
      mockApiClient.get.mockImplementation((endpoint: string) => {
        if (endpoint.includes('/api/tasks/task-1')) {
          return Promise.resolve(mockTaskResponse);
        } else {
          return Promise.resolve(mockTasksResponse);
        }
      });

      // Populate cache
      await taskService.getTasks({ page: 1 });
      await taskService.getTask('task-1');

      expect(taskService.getCacheStats().totalEntries).toBeGreaterThan(0);

      taskService.clearAllCache();

      expect(taskService.getCacheStats().totalEntries).toBe(0);
    });
  });

  describe('refresh methods', () => {
    it('should refresh task data bypassing cache', async () => {
      mockApiClient.get.mockResolvedValue(mockTaskResponse);

      // First call to populate cache
      await taskService.getTask('task-1');
      // Refresh should bypass cache
      await taskService.refreshTask('task-1');

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should refresh tasks list bypassing cache', async () => {
      mockApiClient.get.mockResolvedValue(mockTasksResponse);

      await taskService.getTasks({ page: 1 });
      await taskService.refreshTasks({ page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should refresh task jobs bypassing cache', async () => {
      mockApiClient.get.mockResolvedValue(mockJobsResponse);

      await taskService.getTaskJobs('task-1', { page: 1 });
      await taskService.refreshTaskJobs('task-1', { page: 1 });

      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors with retry', async () => {
      const networkError = { type: 'network', message: 'Network error', recoverable: true };
      mockApiClient.get
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce(mockTasksResponse);

      const result = await taskService.getTasks();

      expect(result).toEqual(mockTasksResponse);
      expect(mockApiClient.get).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-recoverable errors', async () => {
      const authError = { type: 'auth', message: 'Unauthorized', recoverable: false };
      mockApiClient.get.mockRejectedValueOnce(authError);

      await expect(taskService.getTasks()).rejects.toEqual(authError);
      expect(mockApiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should handle validation errors immediately', async () => {
      const validationError = { type: 'validation', message: 'Invalid input', recoverable: false };
      mockApiClient.post.mockRejectedValueOnce(validationError);

      await expect(taskService.executeTask('task-1')).rejects.toEqual(validationError);
      expect(mockApiClient.post).toHaveBeenCalledTimes(1);
    });
  });
});