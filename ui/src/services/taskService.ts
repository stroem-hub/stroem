import { apiClient } from './apiClient';
import type { 
  TasksResponse,
  TaskResponse,
  TaskJobsResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  TaskListParams,
  JobListParams
} from './apiTypes';
import type { Task, Job, PaginatedResponse } from '../types';

/**
 * Task service for managing tasks and task executions
 */
export class TaskService {
  /**
   * Get paginated list of tasks
   */
  async getTasks(params: TaskListParams = {}): Promise<PaginatedResponse<Task>> {
    const queryParams = new URLSearchParams();
    
    if (params.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }
    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.search) {
      queryParams.append('search', params.search);
    }
    if (params.sort_by) {
      queryParams.append('sort_by', params.sort_by);
    }
    if (params.sort_order) {
      queryParams.append('sort_order', params.sort_order);
    }

    const endpoint = `/api/tasks${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<TasksResponse>(endpoint);
  }

  /**
   * Get specific task by ID
   */
  async getTask(taskId: string): Promise<Task> {
    const response = await apiClient.get<TaskResponse>(`/api/tasks/${taskId}`);
    return response.task;
  }

  /**
   * Get jobs for a specific task
   */
  async getTaskJobs(taskId: string, params: JobListParams = {}): Promise<PaginatedResponse<Job>> {
    const queryParams = new URLSearchParams();
    
    if (params.page !== undefined) {
      queryParams.append('page', params.page.toString());
    }
    if (params.limit !== undefined) {
      queryParams.append('limit', params.limit.toString());
    }
    if (params.status) {
      queryParams.append('status', params.status);
    }
    if (params.start_date) {
      queryParams.append('start_date', params.start_date);
    }
    if (params.end_date) {
      queryParams.append('end_date', params.end_date);
    }
    if (params.sort_by) {
      queryParams.append('sort_by', params.sort_by);
    }
    if (params.sort_order) {
      queryParams.append('sort_order', params.sort_order);
    }

    const endpoint = `/api/tasks/${taskId}/jobs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return apiClient.get<TaskJobsResponse>(endpoint);
  }

  /**
   * Execute a task manually
   */
  async executeTask(taskId: string, parameters?: Record<string, unknown>): Promise<string> {
    const request: TaskExecutionRequest = {
      task_id: taskId,
      ...(parameters && { parameters }),
    };

    const response = await apiClient.post<TaskExecutionResponse>('/api/run', request);
    return response.job_id;
  }

  /**
   * Get all tasks (without pagination)
   */
  async getAllTasks(): Promise<Task[]> {
    const response = await this.getTasks({ limit: 1000 }); // Large limit to get all
    return response.data;
  }

  /**
   * Search tasks by name or description
   */
  async searchTasks(query: string, limit: number = 20): Promise<Task[]> {
    const response = await this.getTasks({ 
      search: query, 
      limit,
      sort_by: 'name',
      sort_order: 'asc'
    });
    return response.data;
  }
}

// Create singleton instance
export const taskService = new TaskService();