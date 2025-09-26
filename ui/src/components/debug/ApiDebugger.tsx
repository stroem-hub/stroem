import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader } from '../ui/Card';
import { taskService } from '../../services/taskService';

/**
 * Debug component to inspect API responses
 * This component helps debug API response formats
 */
interface DebugResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  serviceResult?: any;
  serviceError?: any;
}

export const ApiDebugger: React.FC = () => {
  const [taskId, setTaskId] = useState('');
  const [response, setResponse] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const debugTaskApi = async () => {
    if (!taskId.trim()) {
      setError('Please enter a task ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResponse(null);

    try {
      // Make direct API call to see raw response
      const rawResponse = await fetch(`/api/tasks/${taskId.trim()}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token') || ''}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await rawResponse.json();
      
      setResponse({
        status: rawResponse.status,
        statusText: rawResponse.statusText,
        headers: Object.fromEntries(rawResponse.headers.entries()),
        data: data,
      });

      // Also try the service method
      try {
        const serviceResult = await taskService.getTask(taskId.trim());
        setResponse(prev => prev ? ({
          ...prev,
          serviceResult: serviceResult,
        }) : null);
      } catch (serviceError) {
        setResponse(prev => prev ? ({
          ...prev,
          serviceError: serviceError,
        }) : null);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-4xl mx-auto">
      <CardHeader>
        <h2 className="text-lg font-semibold">API Response Debugger</h2>
        <p className="text-sm text-gray-600">
          Debug tool to inspect API responses and understand data formats
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex space-x-2">
            <input
              type="text"
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              placeholder="Enter task ID"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              onClick={debugTaskApi}
              loading={loading}
              disabled={loading}
            >
              Debug Task API
            </Button>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-800 text-sm">{error}</p>
            </div>
          )}

          {response && (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-900 mb-2">Raw API Response:</h3>
                <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-96">
                  {JSON.stringify(response, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ApiDebugger;