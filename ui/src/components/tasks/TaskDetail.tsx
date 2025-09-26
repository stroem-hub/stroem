import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge, StatusBadge } from '../ui/Badge';
import { ConfirmModal } from '../ui/Modal';
import { Pagination } from '../ui/Pagination';
import { Spinner, SkeletonCard } from '../ui/Loading';
import { Alert } from '../ui/Alert';
import { taskService } from '../../services/taskService';
import { cn, formatDateTime, formatDuration } from '../../utils';
import type { Task, Job, PaginatedResponse, AppError } from '../../types';

export interface TaskDetailProps {
  taskId: string;
  onClose?: () => void;
  className?: string;
}

interface TaskDetailState {
  task: Task | null;
  jobs: Job[];
  loading: boolean;
  jobsLoading: boolean;
  error: AppError | null;
  jobsError: AppError | null;
  executing: boolean;
  showExecuteConfirm: boolean;
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
  };
}

export const TaskDetail: React.FC<TaskDetailProps> = ({
  taskId,
  onClose,
  className,
}) => {
  const navigate = useNavigate();
  const [state, setState] = useState<TaskDetailState>({
    task: null,
    jobs: [],
    loading: true,
    jobsLoading: true,
    error: null,
    jobsError: null,
    executing: false,
    showExecuteConfirm: false,
    pagination: {
      currentPage: 1,
      totalPages: 1,
      totalItems: 0,
      itemsPerPage: 10,
    },
  });

  // Load task details
  const loadTask = useCallback(async (skipCache = false) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const task = await taskService.getTask(taskId, { skipCache });
      setState(prev => ({ ...prev, task, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error as AppError,
      }));
    }
  }, [taskId]);

  // Load task jobs
  const loadJobs = useCallback(async (skipCache = false) => {
    setState(prev => ({ ...prev, jobsLoading: true, jobsError: null }));

    try {
      const response: PaginatedResponse<Job> = await taskService.getTaskJobs(
        taskId,
        {
          page: state.pagination.currentPage,
          limit: state.pagination.itemsPerPage,
          sort_by: 'start_datetime',
          sort_order: 'desc',
        },
        { skipCache }
      );

      setState(prev => ({
        ...prev,
        jobs: response.data,
        jobsLoading: false,
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
        jobsLoading: false,
        jobsError: error as AppError,
      }));
    }
  }, [taskId, state.pagination.currentPage, state.pagination.itemsPerPage]);

  // Initial load
  useEffect(() => {
    loadTask();
    loadJobs();
  }, [loadTask, loadJobs]);

  // Handle task execution
  const handleExecuteTask = useCallback(async () => {
    setState(prev => ({ ...prev, executing: true, showExecuteConfirm: false }));

    try {
      const jobId = await taskService.executeTask(taskId);
      
      // Refresh task data and jobs
      await Promise.all([
        loadTask(true),
        loadJobs(true),
      ]);

      // Navigate to job details if possible
      navigate(`/jobs/${jobId}`);
    } catch (error) {
      console.error('Failed to execute task:', error);
      // You might want to show a toast notification here
    } finally {
      setState(prev => ({ ...prev, executing: false }));
    }
  }, [taskId, loadTask, loadJobs, navigate]);

  // Handle page change for jobs
  const handleJobsPageChange = useCallback((page: number) => {
    setState(prev => ({
      ...prev,
      pagination: { ...prev.pagination, currentPage: page },
    }));
  }, []);

  // Handle job navigation
  const handleViewJob = useCallback((jobId: string) => {
    navigate(`/jobs/${jobId}`);
  }, [navigate]);

  // Handle refresh
  const handleRefresh = useCallback(() => {
    loadTask(true);
    loadJobs(true);
  }, [loadTask, loadJobs]);

  // Retry loading on error
  const handleRetry = useCallback(() => {
    if (state.error) {
      loadTask(true);
    }
    if (state.jobsError) {
      loadJobs(true);
    }
  }, [state.error, state.jobsError, loadTask, loadJobs]);

  if (state.loading && !state.task) {
    return (
      <div className={cn('space-y-6', className)}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (state.error && !state.task) {
    return (
      <div className={cn('space-y-6', className)}>
        <Alert variant="error">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Failed to load task</h3>
              <p className="mt-1 text-sm">{state.error.message}</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  if (!state.task) {
    return (
      <div className={cn('text-center py-12', className)}>
        <h3 className="text-lg font-medium text-gray-900">Task not found</h3>
        <p className="mt-2 text-sm text-gray-500">
          The requested task could not be found.
        </p>
      </div>
    );
  }

  const { task } = state;
  const displayName = task.name || task.id;
  const successRate = task.statistics.total_executions > 0 
    ? Math.round((task.statistics.success_count / task.statistics.total_executions) * 100)
    : 0;

  return (
    <div className={cn('space-y-6', className)}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            {onClose && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="p-1"
                aria-label="Go back"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 truncate">
                {displayName}
              </h1>
              {task.name && task.id !== task.name && (
                <p className="mt-1 text-sm text-gray-500 font-mono">
                  ID: {task.id}
                </p>
              )}
            </div>
          </div>
          {task.description && (
            <p className="mt-2 text-sm text-gray-600">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex items-center space-x-3 ml-4">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={state.loading || state.jobsLoading}
            className="flex items-center space-x-2"
          >
            <svg
              className={`w-4 h-4 ${state.loading || state.jobsLoading ? 'animate-spin' : ''}`}
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
          <Button
            variant="primary"
            onClick={() => setState(prev => ({ ...prev, showExecuteConfirm: true }))}
            loading={state.executing}
            disabled={state.executing}
          >
            Execute Task
          </Button>
        </div>
      </div>

      {/* Task Statistics */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900">Statistics</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900">
                {task.statistics.total_executions}
              </div>
              <div className="text-sm text-gray-500">Total Executions</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600">
                {task.statistics.success_count}
              </div>
              <div className="text-sm text-gray-500">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-red-600">
                {task.statistics.failure_count}
              </div>
              <div className="text-sm text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-600">
                {formatDuration(task.statistics.average_duration)}
              </div>
              <div className="text-sm text-gray-500">Average Duration</div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Success Rate</span>
              <Badge 
                variant={successRate >= 90 ? 'success' : successRate >= 70 ? 'warning' : 'error'}
                size="md"
              >
                {successRate}%
              </Badge>
            </div>
            
            {task.statistics.last_execution && (
              <div className="mt-4 space-y-2">
                <h4 className="text-sm font-medium text-gray-700">Last Execution</h4>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Status:</span>
                  <StatusBadge status={task.statistics.last_execution.status} size="sm" />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Duration:</span>
                  <span className="text-gray-900">
                    {formatDuration(task.statistics.last_execution.duration)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Triggered by:</span>
                  <span className="text-gray-900">
                    {task.statistics.last_execution.triggered_by}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">Time:</span>
                  <span className="text-gray-900">
                    {formatDateTime(task.statistics.last_execution.timestamp)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Task Configuration */}
      {(task.input || task.flow) && (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold text-gray-900">Configuration</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Input Fields */}
              {task.input && Object.keys(task.input).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Input Parameters</h3>
                  <div className="space-y-3">
                    {Object.entries(task.input)
                      .sort(([, a], [, b]) => (a.order || 0) - (b.order || 0))
                      .map(([key, field]) => (
                        <div key={key} className="border border-gray-200 rounded-md p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-900">{field.id}</span>
                            <div className="flex items-center space-x-2">
                              <Badge variant={field.required ? 'error' : 'secondary'} size="sm">
                                {field.required ? 'Required' : 'Optional'}
                              </Badge>
                              <Badge variant="info" size="sm">
                                {field.type}
                              </Badge>
                            </div>
                          </div>
                          {field.description && (
                            <p className="text-sm text-gray-600 mb-2">{field.description}</p>
                          )}
                          {field.default && (
                            <div className="text-xs text-gray-500">
                              Default: <code className="bg-gray-100 px-1 rounded">{field.default}</code>
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Flow Steps */}
              {task.flow && Object.keys(task.flow).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Workflow Steps</h3>
                  <div className="space-y-3">
                    {Object.entries(task.flow).map(([key, step]) => (
                      <div key={key} className="border border-gray-200 rounded-md p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-900">
                            {step.name || step.id}
                          </span>
                          <Badge variant="info" size="sm">
                            {step.action}
                          </Badge>
                        </div>
                        {step.depends_on && step.depends_on.length > 0 && (
                          <div className="text-xs text-gray-500 mb-2">
                            Depends on: {step.depends_on.join(', ')}
                          </div>
                        )}
                        {step.continue_on_fail && (
                          <Badge variant="warning" size="sm" className="mr-2">
                            Continue on Fail
                          </Badge>
                        )}
                        {step.on_error && (
                          <div className="text-xs text-gray-500">
                            On error: {step.on_error}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Execution History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Execution History</h2>
            {state.pagination.totalItems > 0 && (
              <span className="text-sm text-gray-500">
                {state.pagination.totalItems} total executions
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Jobs Error */}
          {state.jobsError && (
            <Alert variant="error" className="mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Failed to load execution history</h3>
                  <p className="mt-1 text-sm">{state.jobsError.message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRetry}>
                  Retry
                </Button>
              </div>
            </Alert>
          )}

          {/* Jobs Loading */}
          {state.jobsLoading && state.jobs.length === 0 && (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="animate-pulse">
                  <div className="h-16 bg-gray-200 rounded-md"></div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!state.jobsLoading && state.jobs.length === 0 && !state.jobsError && (
            <div className="text-center py-8">
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
              <h3 className="mt-2 text-sm font-medium text-gray-900">No executions yet</h3>
              <p className="mt-1 text-sm text-gray-500">
                This task hasn't been executed yet.
              </p>
            </div>
          )}

          {/* Jobs List */}
          {state.jobs.length > 0 && (
            <>
              <div className="space-y-3">
                {state.jobs.map((job) => (
                  <div
                    key={job.id}
                    className="border border-gray-200 rounded-md p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewJob(job.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <StatusBadge status={job.status} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDateTime(job.start_datetime)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Triggered by {job.triggered_by}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {job.duration && (
                          <div className="text-sm text-gray-900">
                            {formatDuration(job.duration)}
                          </div>
                        )}
                        {job.end_datetime && (
                          <div className="text-xs text-gray-500">
                            Ended {formatDateTime(job.end_datetime)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Loading overlay for refresh */}
              {state.jobsLoading && state.jobs.length > 0 && (
                <div className="flex justify-center py-4">
                  <Spinner size="md" />
                </div>
              )}

              {/* Pagination */}
              <div className="mt-6">
                <Pagination
                  currentPage={state.pagination.currentPage}
                  totalPages={state.pagination.totalPages}
                  totalItems={state.pagination.totalItems}
                  itemsPerPage={state.pagination.itemsPerPage}
                  onPageChange={handleJobsPageChange}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Execute Confirmation Modal */}
      <ConfirmModal
        isOpen={state.showExecuteConfirm}
        onClose={() => setState(prev => ({ ...prev, showExecuteConfirm: false }))}
        onConfirm={handleExecuteTask}
        title="Execute Task"
        message={`Are you sure you want to execute "${displayName}"? This will start a new job execution.`}
        confirmText="Execute"
        cancelText="Cancel"
        variant="info"
        loading={state.executing}
      />
    </div>
  );
};