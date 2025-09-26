/**
 * Example usage of the TaskService
 * This file demonstrates how to use the task service for various operations
 */

import { taskService } from '../taskService';
import type { TaskListParams } from '../apiTypes';

/**
 * Example: Get paginated list of tasks
 */
export async function getTasksExample() {
  try {
    // Get first page of tasks
    const tasks = await taskService.getTasks({
      page: 1,
      limit: 10,
    });

    console.log('Tasks:', tasks);
    console.log(`Found ${tasks.total} tasks, showing ${tasks.data.length}`);

    return tasks;
  } catch (error) {
    console.error('Failed to fetch tasks:', error);
    throw error;
  }
}

/**
 * Example: Search tasks by name
 */
export async function searchTasksExample(query: string) {
  try {
    const results = await taskService.searchTasks(query, {
      page: 1,
      limit: 20,
    });

    console.log(`Search results for "${query}":`, results);
    return results;
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}

/**
 * Example: Get sorted tasks
 */
export async function getSortedTasksExample() {
  try {
    // Get tasks sorted by last execution time
    const tasks = await taskService.getTasksSorted(
      'last_execution',
      'desc',
      {
        page: 1,
        limit: 10,
      }
    );

    console.log('Recently executed tasks:', tasks);
    return tasks;
  } catch (error) {
    console.error('Failed to fetch sorted tasks:', error);
    throw error;
  }
}

/**
 * Example: Get detailed task information
 */
export async function getTaskDetailExample(taskId: string) {
  try {
    const task = await taskService.getTask(taskId);
    
    console.log('Task details:', task);
    console.log(`Task "${task.name}" has ${task.statistics.total_executions} total executions`);
    console.log(`Success rate: ${((task.statistics.success_count / task.statistics.total_executions) * 100).toFixed(1)}%`);

    return task;
  } catch (error) {
    console.error(`Failed to fetch task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Example: Get jobs for a specific task
 */
export async function getTaskJobsExample(taskId: string) {
  try {
    const jobs = await taskService.getTaskJobs(taskId, {
      page: 1,
      limit: 10,
      sort_by: 'start_datetime',
      sort_order: 'desc',
    });

    console.log(`Jobs for task ${taskId}:`, jobs);
    
    // Show status distribution
    const statusCounts = jobs.data.reduce((acc, job) => {
      acc[job.status] = (acc[job.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('Status distribution:', statusCounts);

    return jobs;
  } catch (error) {
    console.error(`Failed to fetch jobs for task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Example: Execute a task manually
 */
export async function executeTaskExample(taskId: string, parameters: Record<string, unknown> = {}) {
  try {
    // Validate parameters first
    const validation = taskService.validateExecutionParameters(parameters);
    if (!validation.isValid) {
      console.error('Parameter validation failed:', validation.errors);
      throw new Error(`Invalid parameters: ${validation.errors.join(', ')}`);
    }

    console.log(`Executing task ${taskId} with parameters:`, parameters);
    
    const jobId = await taskService.executeTask(taskId, parameters);
    
    console.log(`Task execution started. Job ID: ${jobId}`);
    return jobId;
  } catch (error) {
    console.error(`Failed to execute task ${taskId}:`, error);
    throw error;
  }
}

/**
 * Example: Batch execute multiple tasks
 */
export async function batchExecuteTasksExample() {
  try {
    const executions = [
      { taskId: 'task-1', parameters: { env: 'staging' } },
      { taskId: 'task-2', parameters: { timeout: 300 } },
      { taskId: 'task-3' }, // No parameters
    ];

    console.log('Executing multiple tasks...');
    
    const results = await taskService.executeTasks(executions, {
      failFast: false, // Continue even if some tasks fail
    });

    console.log(`Batch execution completed:`);
    console.log(`- Successful: ${results.successful.length}`);
    console.log(`- Failed: ${results.failed.length}`);

    if (results.successful.length > 0) {
      console.log('Successful executions:', results.successful);
    }

    if (results.failed.length > 0) {
      console.log('Failed executions:', results.failed);
    }

    return results;
  } catch (error) {
    console.error('Batch execution failed:', error);
    throw error;
  }
}

/**
 * Example: Get recent task executions across all tasks
 */
export async function getRecentExecutionsExample() {
  try {
    const recentJobs = await taskService.getRecentTaskExecutions(20);
    
    console.log('Recent task executions:', recentJobs);
    
    // Group by task name
    const byTask = recentJobs.data.reduce((acc, job) => {
      if (!acc[job.task_name]) {
        acc[job.task_name] = [];
      }
      acc[job.task_name]?.push(job);
      return acc;
    }, {} as Record<string, typeof recentJobs.data>);

    console.log('Executions by task:', byTask);

    return recentJobs;
  } catch (error) {
    console.error('Failed to fetch recent executions:', error);
    throw error;
  }
}

/**
 * Example: Advanced filtering and pagination
 */
export async function advancedTaskFilteringExample() {
  try {
    const params: TaskListParams = {
      page: 1,
      limit: 5,
      search: 'deploy',
      sort_by: 'name',
      sort_order: 'asc',
    };

    console.log('Fetching tasks with advanced filtering:', params);
    
    const tasks = await taskService.getTasks(params);
    
    console.log(`Found ${tasks.total} matching tasks`);
    console.log('Current page:', tasks.page);
    console.log('Total pages:', Math.ceil(tasks.total / tasks.limit));

    // Demonstrate pagination
    if (tasks.total > tasks.limit) {
      console.log('Fetching next page...');
      
      const nextPage = await taskService.getTasks({
        ...params,
        page: params.page! + 1,
      });
      
      console.log('Next page results:', nextPage);
    }

    return tasks;
  } catch (error) {
    console.error('Advanced filtering failed:', error);
    throw error;
  }
}

/**
 * Example: Cache management
 */
export async function cacheManagementExample() {
  try {
    // Get initial cache stats
    console.log('Initial cache stats:', taskService.getCacheStats());

    // Fetch some data to populate cache
    await taskService.getTasks({ page: 1, limit: 10 });
    await taskService.getTask('example-task-id');

    console.log('Cache stats after fetching:', taskService.getCacheStats());

    // Clean up expired entries
    const cleanedCount = taskService.cleanupExpiredCache();
    console.log(`Cleaned up ${cleanedCount} expired cache entries`);

    // Clear all cache
    taskService.clearAllCache();
    console.log('Cache cleared. Final stats:', taskService.getCacheStats());

  } catch (error) {
    console.error('Cache management example failed:', error);
    throw error;
  }
}

/**
 * Example: Error handling and retry logic
 */
export async function errorHandlingExample() {
  try {
    // This will likely fail with a validation error
    await taskService.executeTask('', {}); // Empty task ID
  } catch (error) {
    console.log('Caught expected validation error:', error);
  }

  try {
    // This might fail with a network error (depending on server state)
    await taskService.getTask('non-existent-task-id');
  } catch (error) {
    console.log('Caught expected not found error:', error);
  }

  // Demonstrate retry with custom configuration
  try {
    await taskService.executeTask('test-task', {}, { maxRetries: 1 });
  } catch (error) {
    console.log('Task execution failed after retries:', error);
  }
}

/**
 * Example: Real-world workflow
 */
export async function realWorldWorkflowExample() {
  try {
    console.log('=== Real-world Task Management Workflow ===');

    // 1. Get list of available tasks
    console.log('1. Fetching available tasks...');
    const tasks = await taskService.getTasks({ limit: 10 });
    console.log(`Found ${tasks.total} tasks`);

    if (tasks.data.length === 0) {
      console.log('No tasks available');
      return;
    }

    // 2. Select a task and get its details
    const selectedTask = tasks.data[0];
    if (!selectedTask) {
      console.log('No tasks available');
      return;
    }
    console.log(`2. Getting details for task: ${selectedTask.name}`);
    const taskDetails = await taskService.getTask(selectedTask.id);
    console.log('Task statistics:', taskDetails.statistics);

    // 3. Get recent executions for this task
    console.log('3. Fetching recent executions...');
    const recentJobs = await taskService.getTaskJobs(selectedTask.id, {
      limit: 5,
      sort_by: 'start_datetime',
      sort_order: 'desc',
    });
    console.log(`Recent executions: ${recentJobs.data.length}`);

    // 4. Execute the task if it hasn't run recently
    const lastJob = recentJobs.data[0];
    const shouldExecute = !lastJob || 
      (new Date().getTime() - new Date(lastJob.start_datetime).getTime()) > 60000; // 1 minute

    if (shouldExecute) {
      console.log('4. Executing task...');
      const jobId = await taskService.executeTask(selectedTask.id, {
        triggered_by: 'manual',
        environment: 'development',
      });
      console.log(`Task execution started: ${jobId}`);
    } else {
      console.log('4. Task executed recently, skipping execution');
    }

    // 5. Refresh data to see updated statistics
    console.log('5. Refreshing task data...');
    const updatedTask = await taskService.refreshTask(selectedTask.id);
    console.log('Updated statistics:', updatedTask.statistics);

    console.log('=== Workflow completed successfully ===');

  } catch (error) {
    console.error('Real-world workflow failed:', error);
    throw error;
  }
}