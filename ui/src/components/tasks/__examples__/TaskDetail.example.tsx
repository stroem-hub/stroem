import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import { TaskDetail } from '../TaskDetail';

/**
 * Example usage of the TaskDetail component
 * 
 * This component provides a comprehensive view of a task including:
 * - Task metadata and description
 * - Execution statistics and success rate
 * - Task configuration (input parameters and workflow steps)
 * - Execution history with pagination
 * - Task execution functionality with confirmation
 */

// Example 1: Basic usage as a standalone component
export const BasicTaskDetailExample: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="p-6 max-w-6xl mx-auto">
        <TaskDetail taskId="example-task-1" />
      </div>
    </BrowserRouter>
  );
};

// Example 2: Usage with close handler (e.g., in a modal or drawer)
export const TaskDetailWithCloseExample: React.FC = () => {
  const handleClose = () => {
    console.log('Close task detail view');
    // In a real app, this might close a modal or navigate back
  };

  return (
    <BrowserRouter>
      <div className="p-6 max-w-6xl mx-auto">
        <TaskDetail 
          taskId="example-task-2" 
          onClose={handleClose}
        />
      </div>
    </BrowserRouter>
  );
};

// Example 3: Usage in a page layout
export const TaskDetailPageExample: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <TaskDetail taskId="example-task-3" />
        </div>
      </div>
    </BrowserRouter>
  );
};

// Example 4: Custom styling
export const CustomStyledTaskDetailExample: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="p-6 max-w-6xl mx-auto">
        <TaskDetail 
          taskId="example-task-4"
          className="custom-task-detail shadow-lg"
        />
      </div>
    </BrowserRouter>
  );
};

/**
 * Key Features Demonstrated:
 * 
 * 1. **Task Information Display**:
 *    - Task name and ID
 *    - Description
 *    - Execution statistics (total, success, failure, average duration)
 *    - Success rate with color-coded badge
 *    - Last execution details
 * 
 * 2. **Task Configuration**:
 *    - Input parameters with types, requirements, and descriptions
 *    - Workflow steps with dependencies and actions
 *    - Default values and validation rules
 * 
 * 3. **Execution History**:
 *    - Paginated list of job executions
 *    - Status indicators and duration
 *    - Navigation to individual job details
 *    - Empty state handling
 * 
 * 4. **Task Execution**:
 *    - Execute task button with confirmation modal
 *    - Loading states during execution
 *    - Automatic navigation to job details after execution
 *    - Error handling for execution failures
 * 
 * 5. **Navigation & UX**:
 *    - Back button when onClose is provided
 *    - Refresh functionality
 *    - Responsive design
 *    - Loading skeletons
 *    - Error states with retry options
 * 
 * 6. **Accessibility**:
 *    - Proper ARIA labels
 *    - Keyboard navigation support
 *    - Screen reader friendly
 *    - Focus management in modals
 */

export default {
  BasicTaskDetailExample,
  TaskDetailWithCloseExample,
  TaskDetailPageExample,
  CustomStyledTaskDetailExample,
};