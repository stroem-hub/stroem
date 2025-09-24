import { apiClient } from './apiClient';
import type { 
  JobsResponse,
  JobResponse,
  JobLogsResponse,
  JobStepLogsResponse,
  JobExecutionRequest,
  JobListParams,
  SSEEvent
} from './apiTypes';
import type { Job, LogEntry } from '../types';

/**
 * Job service for monitoring job executions and viewing logs
 */
export class JobService {
  /**
   * Get list of jobs
   */
  async getJobs(params: JobListParams = {}): Promise<Job[]> {
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
    if (params.task_name) {
      queryParams.append('task_name', params.task_name);
    }
    if (params.triggered_by) {
      queryParams.append('triggered_by', params.triggered_by);
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

    const endpoint = `/api/jobs${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get<JobsResponse>(endpoint);
    return response.jobs;
  }

  /**
   * Get specific job by ID
   */
  async getJob(jobId: string): Promise<Job> {
    const response = await apiClient.get<JobResponse>(`/api/jobs/${jobId}`);
    return response.job;
  }

  /**
   * Get logs for a specific job
   */
  async getJobLogs(jobId: string): Promise<LogEntry[]> {
    const response = await apiClient.get<JobLogsResponse>(`/api/jobs/${jobId}/logs`);
    return response.logs;
  }

  /**
   * Get logs for a specific job step
   */
  async getJobStepLogs(jobId: string, stepName: string): Promise<LogEntry[]> {
    const response = await apiClient.get<JobStepLogsResponse>(
      `/api/jobs/${jobId}/steps/${stepName}/logs`
    );
    return response.logs;
  }

  /**
   * Execute a job manually
   */
  async executeJob(request: JobExecutionRequest): Promise<string> {
    const response = await apiClient.post<{ job_id: string }>('/api/run', request);
    return response.job_id;
  }

  /**
   * Subscribe to job updates via Server-Sent Events
   */
  subscribeToJobUpdates(
    jobId: string,
    onUpdate: (event: SSEEvent) => void,
    onError?: (error: Event) => void
  ): EventSource {
    const eventSource = new EventSource(`/api/jobs/${jobId}/sse`);

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);
        onUpdate(data);
      } catch (error) {
        console.error('Error parsing SSE event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error);
      if (onError) {
        onError(error);
      }
    };

    return eventSource;
  }

  /**
   * Get recent jobs (last 50)
   */
  async getRecentJobs(limit: number = 50): Promise<Job[]> {
    return this.getJobs({ 
      limit,
      sort_by: 'start_datetime',
      sort_order: 'desc'
    });
  }

  /**
   * Get jobs by status
   */
  async getJobsByStatus(status: Job['status'], limit: number = 100): Promise<Job[]> {
    return this.getJobs({ 
      status,
      limit,
      sort_by: 'start_datetime',
      sort_order: 'desc'
    });
  }

  /**
   * Get running jobs
   */
  async getRunningJobs(): Promise<Job[]> {
    return this.getJobsByStatus('running');
  }

  /**
   * Get failed jobs
   */
  async getFailedJobs(limit: number = 50): Promise<Job[]> {
    return this.getJobsByStatus('failed', limit);
  }

  /**
   * Get completed jobs
   */
  async getCompletedJobs(limit: number = 50): Promise<Job[]> {
    return this.getJobsByStatus('completed', limit);
  }

  /**
   * Search jobs by task name
   */
  async searchJobsByTask(taskName: string, limit: number = 50): Promise<Job[]> {
    return this.getJobs({
      task_name: taskName,
      limit,
      sort_by: 'start_datetime',
      sort_order: 'desc'
    });
  }
}

// Create singleton instance
export const jobService = new JobService();