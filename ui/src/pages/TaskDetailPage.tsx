import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TaskDetail } from '../components/tasks/TaskDetail';

export const TaskDetailPage: React.FC = () => {
  const { taskId } = useParams<{ taskId: string }>();
  const navigate = useNavigate();

  if (!taskId) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900">Invalid Task</h3>
        <p className="mt-2 text-sm text-gray-500">
          No task ID provided in the URL.
        </p>
      </div>
    );
  }

  const handleClose = () => {
    navigate('/tasks');
  };

  return (
    <TaskDetail 
      taskId={taskId} 
      onClose={handleClose}
    />
  );
};