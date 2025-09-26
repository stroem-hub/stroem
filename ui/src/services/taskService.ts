import { apiClient } from './apiClient';
import type { 
  TasksResponse,
  TaskJobsResponse,
  TaskExecutionRequest,
  TaskExecutionResponse,
  TaskListParams,
  JobListParams
} from './apiTypes';
import type { Task, Job, PaginatedResponse, AppError } from '../types';

/**
 * Cache entry interface
 */
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/**
 * Task service configuration
 */
export interface TaskServiceConfig {
  // Cache TTL values in milliseconds
  taskListTTL: number;
  taskDetailTTL: number;
  taskJobsTTL: number;
  // Retry configuration
  maxRetries: number;
  retryDelay: number;
  retryBackoffMultiplier: number;
}

/**
 * Task service for managing tasks, execution, and related operations with caching and error handling
 */
export class TaskService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private config: TaskServiceConfig;

  constructor(config: Partial<TaskServiceConfig> = {}) {
    this.config = {
      // Default TTL values (in milliseconds)
      taskListTTL: 2 * 60 * 1000, // 2 minutes - task list changes infrequently
      taskDetailTTL: 5 * 60 * 1000, // 5 minutes - task details are relatively static
      taskJobsTTL: 30 * 1000, // 30 seconds - job list changes frequently
      // Retry configuration
      maxRetries: 3,
      retryDelay: 1000, // 1 second
      retryBackoffMultiplier: 2,
      ...config,
    };
  }

  /**
   * Generate cache key for request
   */
  private getCacheKey(endpoint: string, params?: Record<string, unknown>): string {
    const paramString = params ? JSON.stringify(params) : '';
    return `${endpoint}:${paramString}`;
  }

  /**
   * Get data from cache if valid
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    
    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store data in cache
   */
  private setCache<T>(key: string, data: T, ttl: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  /**
   * Clear cache entries matching pattern
   */
  private clearCachePattern(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cache entries
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute request with retry logic and caching
   */
  private async executeWithRetryAndCache<T>(
    cacheKey: string,
    ttl: number,
    requestFn: () => Promise<T>,
    options: { skipCache?: boolean; maxRetries?: number } = {}
  ): Promise<T> {
    const { skipCache = false, maxRetries = this.config.maxRetries } = options;

    // Try cache first if not skipping
    if (!skipCache) {
      const cached = this.getFromCache<T>(cacheKey);
      if (cached !== null) {
        return cached;
      }
    }

    let lastError: AppError | null = null;

    // Retry logic
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const data = await requestFn();
        
        // Cache successful response
        this.setCache(cacheKey, data, ttl);
        
        return data;
      } catch (error) {
        lastError = error as AppError;

        // Don't retry for non-recoverable errors
        if (lastError && !lastError.recoverable) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
        await this.sleep(delay);
      }
    }

    // If all retries failed, throw the last error
    throw lastError || {
      type: 'server' as const,
      message: 'Task request failed after multiple attempts',
      recoverable: true,
    };
  }

  /**
   * Build query string from parameters
   */
  private buildQueryString(params: Record<string, unknown>): string {
    const queryParams = new URLSearchParams();
    
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, String(value));
      }
    }

    return queryParams.toString();
  }

  /**
   * Get paginated list of tasks with filtering and sorting
   */
  async getTasks(
    params: TaskListParams = {},
    options: { skipCache?: boolean } = {}
  ): Promise<PaginatedResponse<Task>> {
    const cacheKey = this.getCacheKey('/api/tasks', params as Record<string, unknown>);
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.taskListTTL,
      async () => {
        const queryString = this.buildQueryString(params as Record<string, unknown>);
        const endpoint = `/api/tasks${queryString ? `?${queryString}` : ''}`;
        
        const apiResponse = await apiClient.get<TasksResponse>(endpoint);
        
        // Convert API response to expected format
        const response: PaginatedResponse<Task> = {
          data: apiResponse.data,
          total: apiResponse.pagination.total,
          page: apiResponse.pagination.page,
          limit: apiResponse.pagination.limit,
        };
        
        return response;
      },
      options
    );
  }

  /**
   * Get detailed information about a specific task
   */
  async getTask(
    taskId: string,
    options: { skipCache?: boolean } = {}
  ): Promise<Task> {
    if (!taskId) {
      throw {
        type: 'validation' as const,
        message: 'Task ID is required',
        recoverable: false,
      };
    }

    const cacheKey = this.getCacheKey(`/api/tasks/${taskId}`);
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.taskDetailTTL,
      async () => {
        const response = await apiClient.get<any>(`/api/tasks/${taskId}`);
        
        // Handle different response formats
        // Most likely format based on getTasks pattern: { data: Task }
        if (response.data && response.data.id) {
          return response.data;
        }
        // Alternative format: { task: Task }
        else if (response.task && response.task.id) {
          return response.task;
        }
        // Direct task format: Task
        else if (response.id) {
          return response;
        }
        // If none of the above, throw an error
        else {
          throw {
            type: 'server' as const,
            message: 'Task not found or invalid response format',
            recoverable: false,
          };
        }
      },
      options
    );
  }

  /**
   * Get jobs associated with a specific task
   */
  async getTaskJobs(
    taskId: string,
    params: JobListParams = {},
    options: { skipCache?: boolean } = {}
  ): Promise<PaginatedResponse<Job>> {
    if (!taskId) {
      throw {
        type: 'validation' as const,
        message: 'Task ID is required',
        recoverable: false,
      };
    }

    const cacheKey = this.getCacheKey(`/api/tasks/${taskId}/jobs`, params as Record<string, unknown>);
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.taskJobsTTL,
      async () => {
        const queryString = this.buildQueryString(params as Record<string, unknown>);
        const endpoint = `/api/tasks/${taskId}/jobs${queryString ? `?${queryString}` : ''}`;
        
        const apiResponse = await apiClient.get<TaskJobsResponse>(endpoint);
        
        // Convert API response to expected format
        const response: PaginatedResponse<Job> = {
          data: apiResponse.data,
          total: apiResponse.pagination.total,
          page: apiResponse.pagination.page,
          limit: apiResponse.pagination.limit,
        };
        
        return response;
      },
      options
    );
  }

  /**
   * Execute a task manually (trigger job execution)
   */
  async executeTask(
    taskId: string,
    parameters: Record<string, unknown> = {},
    options: { maxRetries?: number } = {}
  ): Promise<string> {
    if (!taskId) {
      throw {
        type: 'validation' as const,
        message: 'Task ID is required',
        recoverable: false,
      };
    }

    const requestData: TaskExecutionRequest = {
      task_id: taskId,
      ...(Object.keys(parameters).length > 0 && { parameters }),
    };

    let lastError: AppError | null = null;
    const maxRetries = options.maxRetries ?? this.config.maxRetries;

    // Retry logic for task execution
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await apiClient.post<TaskExecutionResponse>(
          `/api/tasks/${taskId}/execute`,
          requestData
        );

        // Clear related cache entries after successful execution
        this.clearCachePattern(`/api/tasks/${taskId}/jobs`);
        this.clearCachePattern('/api/dashboard');
        this.clearCachePattern('/api/jobs');

        return response.job_id;
      } catch (error) {
        lastError = error as AppError;

        // Don't retry for validation errors or non-recoverable errors
        if (lastError && (!lastError.recoverable || lastError.type === 'validation')) {
          throw lastError;
        }

        // Don't retry on last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        const delay = this.config.retryDelay * Math.pow(this.config.retryBackoffMultiplier, attempt);
        await this.sleep(delay);
      }
    }

    // If all retries failed, throw the last error
    throw lastError || {
      type: 'server' as const,
      message: 'Task execution failed after multiple attempts',
      recoverable: true,
    };
  }

  /**
   * Search tasks by name or description
   */
  async searchTasks(
    query: string,
    params: Omit<TaskListParams, 'search'> = {},
    options: { skipCache?: boolean } = {}
  ): Promise<PaginatedResponse<Task>> {
    if (!query.trim()) {
      return this.getTasks(params, options);
    }

    return this.getTasks(
      {
        ...params,
        search: query.trim(),
      },
      options
    );
  }

  /**
   * Get tasks with specific sorting
   */
  async getTasksSorted(
    sortBy: TaskListParams['sort_by'] = 'name',
    sortOrder: TaskListParams['sort_order'] = 'asc',
    params: Omit<TaskListParams, 'sort_by' | 'sort_order'> = {},
    options: { skipCache?: boolean } = {}
  ): Promise<PaginatedResponse<Task>> {
    return this.getTasks(
      {
        ...params,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
      options
    );
  }

  /**
   * Get recent task executions across all tasks
   */
  async getRecentTaskExecutions(
    limit: number = 10,
    options: { skipCache?: boolean } = {}
  ): Promise<PaginatedResponse<Job>> {
    const params: JobListParams = {
      limit,
      sort_by: 'start_datetime',
      sort_order: 'desc',
    };

    const cacheKey = this.getCacheKey('/api/jobs', params as Record<string, unknown>);
    
    return this.executeWithRetryAndCache(
      cacheKey,
      this.config.taskJobsTTL,
      async () => {
        const queryString = this.buildQueryString(params as Record<string, unknown>);
        const endpoint = `/api/jobs${queryString ? `?${queryString}` : ''}`;
        
        const response = await apiClient.get<PaginatedResponse<Job>>(endpoint);
        return response;
      },
      options
    );
  }

  /**
   * Refresh task data (bypass cache)
   */
  async refreshTask(taskId: string): Promise<Task> {
    return this.getTask(taskId, { skipCache: true });
  }

  async refreshTasks(params: TaskListParams = {}): Promise<PaginatedResponse<Task>> {
    return this.getTasks(params, { skipCache: true });
  }

  async refreshTaskJobs(
    taskId: string,
    params: JobListParams = {}
  ): Promise<PaginatedResponse<Job>> {
    return this.getTaskJobs(taskId, params, { skipCache: true });
  }

  /**
   * Get cache statistics for debugging
   */
  getCacheStats(): {
    totalEntries: number;
    validEntries: number;
    expiredEntries: number;
    entries: Array<{
      key: string;
      timestamp: number;
      ttl: number;
      isExpired: boolean;
    }>;
  } {
    const now = Date.now();
    const entries: Array<{
      key: string;
      timestamp: number;
      ttl: number;
      isExpired: boolean;
    }> = [];

    let validEntries = 0;
    let expiredEntries = 0;

    for (const [key, entry] of this.cache.entries()) {
      const isExpired = now - entry.timestamp > entry.ttl;
      
      entries.push({
        key,
        timestamp: entry.timestamp,
        ttl: entry.ttl,
        isExpired,
      });

      if (isExpired) {
        expiredEntries++;
      } else {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries,
      expiredEntries,
      entries,
    };
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredCache(): number {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Validate task execution parameters
   */
  validateExecutionParameters(parameters: Record<string, unknown>): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Basic validation - can be extended based on task schema
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof key !== 'string' || key.trim() === '') {
        errors.push('Parameter keys must be non-empty strings');
        continue;
      }

      // Check for potentially dangerous parameter names
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      if (dangerousKeys.includes(key)) {
        errors.push(`Parameter key "${key}" is not allowed`);
      }

      // Basic type validation
      if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
        try {
          JSON.stringify(value);
        } catch {
          errors.push(`Parameter "${key}" contains non-serializable value`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Batch execute multiple tasks
   */
  async executeTasks(
    executions: Array<{
      taskId: string;
      parameters?: Record<string, unknown>;
    }>,
    options: { 
      maxRetries?: number;
      failFast?: boolean;
    } = {}
  ): Promise<{
    successful: Array<{ taskId: string; jobId: string }>;
    failed: Array<{ taskId: string; error: AppError }>;
  }> {
    const { failFast = false } = options;
    const successful: Array<{ taskId: string; jobId: string }> = [];
    const failed: Array<{ taskId: string; error: AppError }> = [];

    if (failFast) {
      // Execute sequentially and fail on first error
      for (const execution of executions) {
        try {
          const jobId = await this.executeTask(
            execution.taskId,
            execution.parameters,
            options
          );
          successful.push({ taskId: execution.taskId, jobId });
        } catch (error) {
          failed.push({ taskId: execution.taskId, error: error as AppError });
          break; // Stop on first failure
        }
      }
    } else {
      // Execute in parallel and collect all results
      const results = await Promise.allSettled(
        executions.map(async (execution) => {
          try {
            const jobId = await this.executeTask(
              execution.taskId,
              execution.parameters,
              options
            );
            return { taskId: execution.taskId, jobId };
          } catch (error) {
            throw error;
          }
        })
      );

      results.forEach((result, index) => {
        const execution = executions[index];
        if (!execution) return;
        
        if (result.status === 'fulfilled') {
          successful.push(result.value);
        } else {
          failed.push({
            taskId: execution.taskId,
            error: result.reason as AppError,
          });
        }
      });
    }

    return { successful, failed };
  }
}

// Create singleton instance with default configuration
export const taskService = new TaskService();