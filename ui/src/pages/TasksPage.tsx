import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TaskCard } from '../components/tasks/TaskCard';
import { TaskFilters } from '../components/tasks/TaskFilters';
import { Pagination } from '../components/ui/Pagination';
import { Spinner, SkeletonCard } from '../components/ui/Loading';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { taskService } from '../services/taskService';
import type { Task, PaginatedResponse, AppError } from '../types';
import type { TaskListParams } from '../services/apiTypes';

interface TasksPageState {
  tasks: Task[];
  loading: boolean;
  error: AppError | null;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
  filters: {
    searchQuery: string;
    sortBy: 'name' | 'total_executions' | 'success_rate' | 'average_duration';
    sortOrder: 'asc' | 'desc';
  };
  executingTasks: Set<string>;
}

export const TasksPage: React.FC = () => {
  const navigate = useNavigate();
  const [state, setState] = useState<TasksPageState>({
    tasks: [],
    loading: true,
    error: null,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 12,
    },
    filters: {
      searchQuery: '',
      sortBy: 'name',
      sortOrder: 'asc',
    },
    executingTasks: new Set(),
  });

  // Load tasks with current filters and pagination
  const loadTasks = useCallback(async (skipCache = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const params: TaskListParams = {
        page: state.pagination.currentPage,
        limit: state.pagination.itemsPerPage,
        sort_by: state.filters.sortBy,
        sort_order: state.filters.sortOrder,
      };

      if (state.filters.searchQuery) {
        params.search = state.filters.searchQuery;
      }

      const response: PaginatedResponse<Task> = await taskService.getTasks(
        params,
        { skipCache }
      );

      setState(prev => ({
        ...prev,
        tasks: response.data,
        loading: false,
        pagination: {
          ...prev.pagination,
          totalPages: Math.ceil(response.total / response.limit),
          totalItems: response.total,
          currentPage: response.page,
          itemsPerPage: response.limit,
        },
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as AppError,
      }));
    }
  }, [state.pagination.currentPage, state.pagination.itemsPerPage, state.filters]);

  // Initial load and reload when filters change
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle search query change
  const handleSearchChange = useCallback((searchQuery: string) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, searchQuery },
      pagination: { ...prev.pagination, currentPage: 1 }, // Reset to first page
    }));
  }, []);

  // Handle sort change
  const handleSortChange = useCallback((
    sortBy: TasksPageState['filters']['sortBy'],
    sortOrder: TasksPageState['filters']['sortOrder']
  ) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, sortBy, sortOrder },
      pagination: { ...prev.pagination, currentPage: 1 }, // Reset to first page
    }));
  }, []);

  // Handle clear filters
  const handleClearFilters = useCallback(() => {
    setState(prev => ({
      ...prev,
      filters: {
        searchQuery: '',
        sortBy: 'name',
        sortOrder: 'asc',
      },
      pagination: { ...prev.pagination, currentPage: 1 },
    }));
  }, []);

  // Handle page change
  const handlePageChange = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, currentPage: page },
    }));
  }, []);

  // Handle task execution
  const handleExecuteTask = useCallback(async (taskId: string) => {
    setState(prev => ({
      ...prev,
      executingTasks: new Set([...prev.executingTasks, taskId]),
    }));

    try {
      const jobId = await taskService.executeTask(taskId);
      
      // Show success message or redirect to job details
      console.log(`Task ${taskId} executed successfully. Job ID: ${jobId}`);
      
      // Refresh tasks to update statistics
      loadTasks(true);
    } catch (error) {
      console.error('Failed to execute task:', error);
      // You might want to show a toast notification here
    } finally {
      setState(prev => ({
        ...prev,
        executingTasks: new Set([...prev.executingTasks].filter(id => id !== taskId)),
      }));
    }
  }, [loadTasks]);

  // Handle view task details
  const handleViewDetails = useCallback((taskId: string) => {
    navigate(`/tasks/${taskId}`);
  }, [navigate]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadTasks(true);
  }, [loadTasks]);

  // Retry loading on error
  const handleRetry = useCallback(() => {
    loadTasks(true);
  }, [loadTasks]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="mt-2 text-sm text-gray-700">
            Manage and execute workflow tasks
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          disabled={state.loading}
          className="flex items-center space-x-2"
        >
          <svg
            className={`w-4 h-4 ${state.loading ? 'animate-spin' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
          <span>Refresh</span>
        </Button>
      </div>

      {/* Filters */}
      <TaskFilters
        searchQuery={state.filters.searchQuery}
        sortBy={state.filters.sortBy}
        sortOrder={state.filters.sortOrder}
        onSearchChange={handleSearchChange}
        onSortChange={handleSortChange}
        onClearFilters={handleClearFilters}
      />

      {/* Error State */}
      {state.error && (
        <Alert variant="error" className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Failed to load tasks</h3>
              <p className="mt-1 text-sm">{state.error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Loading State */}
      {state.loading && state.tasks.length === 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, index) => (
            <SkeletonCard key={index} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!state.loading && state.tasks.length === 0 && !state.error && (
        <div className="text-center py-12">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No tasks found</h3>
          <p className="mt-1 text-sm text-gray-500">
            {state.filters.searchQuery
              ? 'Try adjusting your search criteria.'
              : 'No tasks have been configured yet.'}
          </p>
          {state.filters.searchQuery && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="mt-4"
            >
              Clear search
            </Button>
          )}
        </div>
      )}

      {/* Tasks Grid */}
      {state.tasks.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {state.tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onExecute={handleExecuteTask}
                onViewDetails={handleViewDetails}
                loading={state.executingTasks.has(task.id)}
              />
            ))}
          </div>

          {/* Loading overlay for refresh */}
          {state.loading && state.tasks.length > 0 && (
            <div className="flex justify-center py-4">
              <Spinner size="md" />
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={state.pagination.currentPage}
            totalPages={state.pagination.totalPages}
            totalItems={state.pagination.totalItems}
            itemsPerPage={state.pagination.itemsPerPage}
            onPageChange={handlePageChange}
            className="mt-8"
          />
        </>
      )}
    </div>
  );
};