import React from 'react';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn, formatDuration } from '../../utils';
import type { Task } from '../../types';

export interface TaskCardProps {
  task: Task;
  onExecute?: (taskId: string) => void;
  onViewDetails?: (taskId: string) => void;
  loading?: boolean;
  className?: string;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onExecute,
  onViewDetails,
  loading = false,
  className,
}) => {
  const { statistics } = task;
  const successRate = statistics.total_executions > 0 
    ? Math.round((statistics.success_count / statistics.total_executions) * 100)
    : 0;

  const getSuccessRateVariant = (rate: number) => {
    if (rate >= 90) return 'success';
    if (rate >= 70) return 'warning';
    return 'error';
  };

  // Use task name if available, otherwise fall back to ID
  const displayName = task.name || task.id;

  return (
    <Card className={cn('hover:shadow-md transition-shadow', className)}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 truncate">
              {displayName}
            </h3>
            {task.name && task.id !== task.name && (
              <p className="mt-1 text-xs text-gray-500 font-mono">
                ID: {task.id}
              </p>
            )}
            {task.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">
                {task.description}
              </p>
            )}
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <Badge variant={getSuccessRateVariant(successRate)} size="sm">
              {successRate}% success
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-4">
          {/* Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {statistics.total_executions}
              </div>
              <div className="text-xs text-gray-500">Total Runs</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {statistics.success_count}
              </div>
              <div className="text-xs text-gray-500">Successful</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {statistics.failure_count}
              </div>
              <div className="text-xs text-gray-500">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {formatDuration(statistics.average_duration)}
              </div>
              <div className="text-xs text-gray-500">Avg Duration</div>
            </div>
          </div>

          {/* Last Execution Info */}
          {statistics.last_execution && (
            <div className="pt-2 border-t border-gray-100">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Last run:</span>
                <div className="flex items-center space-x-2">
                  <Badge 
                    variant={statistics.last_execution.status === 'success' ? 'success' : 'error'} 
                    size="sm"
                  >
                    {statistics.last_execution.status}
                  </Badge>
                  <span className="text-gray-600">
                    {formatDuration(statistics.last_execution.duration)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails?.(task.id)}
              disabled={loading}
            >
              View Details
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onExecute?.(task.id)}
              loading={loading}
              disabled={loading}
            >
              Execute Task
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};