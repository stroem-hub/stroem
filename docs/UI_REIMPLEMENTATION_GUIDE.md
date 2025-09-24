# Strøm UI Functional Specification

This document provides a comprehensive functional specification for reimplementing the Strøm UI using any technology stack. It focuses on functional requirements, user interactions, data flows, and API communication patterns while remaining technology-agnostic.

## Table of Contents

1. [Application Overview](#application-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [API Communication](#api-communication)
4. [Page Structure & Navigation](#page-structure--navigation)
5. [Dashboard Functionality](#dashboard-functionality)
6. [Task Management](#task-management)
7. [Job Management](#job-management)
8. [User Interface Requirements](#user-interface-requirements)
9. [Data Models](#data-models)
10. [User Experience Patterns](#user-experience-patterns)

## Application Overview

Strøm is a workflow orchestration and automation platform with a web-based management interface. The UI provides monitoring, configuration, and execution capabilities for distributed task workflows.

### Core Functionality
- **Dashboard**: Real-time system monitoring with metrics and alerts
- **Task Management**: Browse, configure, and execute workflow tasks
- **Job Monitoring**: Track execution history and status
- **User Authentication**: Secure access with JWT tokens and refresh mechanism

### User Roles
- **Administrators**: Full system access including user management
- **Operators**: Task execution and monitoring capabilities
- **Viewers**: Read-only access to system status and history

## Authentication & Authorization

### Authentication Flow
1. **Login Process**: User submits email/password to `/api/auth/login`
2. **Token Management**: Server returns access token (short-lived) and refresh token (long-lived, HTTP-only cookie)
3. **Request Authentication**: Access token included in `Authorization: Bearer <token>` header
4. **Token Refresh**: Automatic refresh on 401 responses using `/api/auth/refresh` endpoint
5. **Logout**: Clear tokens and redirect to login page

### Session Management
- **Access Token**: JWT token stored in memory/localStorage, expires in 30 minutes
- **Refresh Token**: HTTP-only cookie, expires in 30 days
- **Auto-refresh**: Seamless token renewal without user intervention
- **Session Expiry**: Redirect to login when refresh fails

### Protected Routes
All application routes except `/login` require authentication:
- Check for valid access token on route access
- Attempt token refresh if token is missing/expired
- Redirect to login page if authentication fails

### User Context
Authenticated user information includes:
- `user_id`: Unique identifier
- `email`: User email address  
- `name`: Display name (optional)
- `roles`: User permissions (future implementation)

## API Communication

### Base Configuration
- **Base URL**: `/api` (relative to application domain)
- **Content Type**: `application/json`
- **Authentication**: Bearer token in Authorization header
- **Credentials**: Include cookies for refresh token

### Request Pattern
All API requests should follow this pattern:

1. **Include Authentication**: Add `Authorization: Bearer <token>` header
2. **Set Content Type**: `Content-Type: application/json`
3. **Include Credentials**: `credentials: 'include'` for refresh token access
4. **Handle 401 Responses**: Attempt token refresh and retry request
5. **Error Handling**: Implement retry logic with exponential backoff

### Authentication Endpoints

#### Login
- **Endpoint**: `POST /api/auth/login`
- **Request Body**: `{ email: string, password: string }`
- **Response**: `{ data: { access_token: string, user: UserObject } }`
- **Side Effect**: Sets HTTP-only refresh token cookie

#### Token Refresh
- **Endpoint**: `POST /api/auth/refresh`
- **Request**: No body, relies on HTTP-only cookie
- **Response**: `{ data: { access_token: string, user: UserObject } }`
- **Usage**: Called automatically on 401 responses

#### Logout
- **Endpoint**: `POST /api/auth/logout`
- **Effect**: Clears refresh token cookie

### Dashboard Endpoints

#### System Status
- **Endpoint**: `GET /api/dashboard/system-status`
- **Response**: System health metrics including active workers, jobs today, uptime
- **Refresh**: Every 30 seconds

#### Job Execution Metrics
- **Endpoint**: `GET /api/dashboard/job-metrics`
- **Response**: Job statistics, success rates, status distribution
- **Refresh**: Every 30 seconds

#### Recent Activity
- **Endpoint**: `GET /api/dashboard/recent-activity`
- **Response**: Recent jobs, alerts, upcoming scheduled jobs
- **Refresh**: Every 30 seconds

#### Job Trends
- **Endpoint**: `GET /api/dashboard/job-trends?range={1h|24h|7d|30d}`
- **Response**: Time-series data for job execution trends
- **Parameters**: `range` - time period for trend data

### Task Management Endpoints

#### Task List
- **Endpoint**: `GET /api/tasks`
- **Parameters**: 
  - `page` (default: 1)
  - `limit` (default: 25, max: 100)
  - `sort` (name, lastExecution, successRate)
  - `order` (asc, desc)
  - `search` (optional text search)
- **Response**: Paginated task list with execution statistics

#### Task Detail
- **Endpoint**: `GET /api/tasks/{taskId}`
- **Response**: Complete task configuration and statistics

#### Task Execution
- **Endpoint**: `POST /api/tasks/{taskId}/execute`
- **Request Body**: Task input parameters
- **Response**: Job ID for the created execution

### Job Management Endpoints

#### Job List
- **Endpoint**: `GET /api/jobs`
- **Parameters**: Similar pagination and filtering as tasks
- **Response**: Paginated job execution history

#### Job Detail
- **Endpoint**: `GET /api/jobs/{jobId}`
- **Response**: Complete job execution details, logs, and output

#### Job Logs
- **Endpoint**: `GET /api/jobs/{jobId}/logs`
- **Response**: Real-time job execution logs
- **Note**: May support streaming/WebSocket for live updates

### Response Format

All API responses follow a consistent structure:

```json
{
  "data": "Response data object or array",
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 100,
    "total_pages": 4,
    "has_next": true,
    "has_prev": false
  },
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "details": {}
  }
}
```

### Error Handling

#### HTTP Status Codes
- **200**: Success
- **401**: Unauthorized (trigger token refresh)
- **403**: Forbidden (insufficient permissions)
- **404**: Resource not found
- **422**: Validation error
- **500**: Server error

#### Retry Strategy
- **Max Retries**: 3 attempts
- **Backoff**: Exponential (1s, 2s, 4s)
- **Retry Conditions**: Network errors, 500-level responses
- **No Retry**: 400-level client errors (except 401)

## Page Structure & Navigation

### Application Routes
The application consists of the following main routes:

- **`/`** - Dashboard (default route)
- **`/login`** - Authentication page (public)
- **`/tasks`** - Task list with pagination and filtering
- **`/tasks/{taskId}`** - Individual task detail page
- **`/jobs/{jobId}`** - Individual job detail page
- **`/actions`** - Action management (future implementation)
- **`/triggers`** - Trigger management (future implementation)

### Layout Structure

#### Authenticated Layout
For logged-in users, the application uses a sidebar layout:
- **Sidebar**: Collapsible navigation menu on the left
- **Main Content**: Page content with responsive margin based on sidebar state
- **Header**: Optional page-specific header area

#### Public Layout
For unauthenticated routes (login), use a centered layout without sidebar.

### Navigation Menu

The sidebar contains the following navigation items:

| Item | Label | Route | Icon | Description |
|------|-------|-------|------|--------------|
| dashboard | Dashboard | `/` | Dashboard icon | System overview and metrics |
| tasks | Tasks | `/tasks` | Tasks icon | Workflow task management |
| actions | Actions | `/actions` | Actions icon | Action definitions (future) |
| triggers | Triggers | `/triggers` | Triggers icon | Trigger configurations (future) |

### Sidebar Behavior
- **Responsive**: Collapses to icon-only on smaller screens
- **Toggle**: Users can manually expand/collapse
- **Active State**: Highlight current route
- **User Menu**: Display user info and logout option

### Breadcrumb Navigation
Implement breadcrumbs for nested pages:
- **Task Detail**: Dashboard > Tasks > [Task Name]
- **Job Detail**: Dashboard > Jobs > [Job ID]

### URL State Management

For pages with filtering, sorting, and pagination, persist state in URL parameters:

#### Task List Parameters
- `page`: Current page number
- `limit`: Items per page
- `sort`: Sort field (name, lastExecution, successRate)
- `order`: Sort direction (asc, desc)
- `search`: Search query

#### Job List Parameters
- `page`: Current page number
- `limit`: Items per page
- `status`: Filter by job status
- `sort`: Sort field
- `order`: Sort direction

Example URL: `/tasks?page=2&limit=50&sort=successRate&order=desc&search=backup`


## Dashboard Functionality

### Dashboard Layout

The dashboard uses a responsive grid layout with four main widgets:

**Top Row (2 columns on desktop, stacked on mobile):**
- **System Status Widget** - Left column
- **Job Execution Metrics Widget** - Right column

**Bottom Row (3 columns on desktop, stacked on mobile):**
- **Recent Activity Widget** - 1 column (left)
- **Job Execution Trends Widget** - 2 columns (right)

### Widget Requirements

#### 1. System Status Widget
**Purpose**: Display current system health and capacity

**Data Display**:
- Active Workers: Number of workers currently processing jobs
- Idle Workers: Number of workers available for new jobs
- Total Jobs Today: Count of jobs executed in the current day
- System Uptime: Duration since system startup
- Average Execution Time (24h): Mean job duration over last 24 hours
- System Alerts: List of current warnings or errors

**Visual Elements**:
- Metric cards with numbers and trend indicators
- Alert list with severity icons (info, warning, error)
- Status indicators (green for healthy, red for issues)

#### 2. Job Execution Metrics Widget
**Purpose**: Show job performance statistics

**Data Display**:
- Today's Statistics:
  - Total jobs executed
  - Success count and percentage
  - Failure count and percentage
- Status Distribution (current):
  - Running jobs
  - Completed jobs
  - Failed jobs
  - Queued jobs
- Top Failing Workflows: List of workflows with highest failure rates
- Average Execution Time: Overall mean job duration

**Visual Elements**:
- Progress bars for success/failure rates
- Donut chart for status distribution
- Table for failing workflows

#### 3. Recent Activity Widget
**Purpose**: Show latest system activity

**Data Display**:
- Recent Jobs: Last 10 job executions with status
- System Alerts: Current active alerts
- Upcoming Jobs: Next scheduled executions

**Visual Elements**:
- Activity feed with timestamps
- Status badges for job states
- Relative time formatting ("2 minutes ago")

#### 4. Job Execution Trends Widget
**Purpose**: Visualize job execution patterns over time

**Data Display**:
- Time-series chart showing successful vs failed jobs
- Configurable time ranges: 1h, 24h, 7d, 30d
- Data points with timestamps and job counts

**Visual Elements**:
- Line chart with dual series (success/failure)
- Time range selector buttons
- Responsive chart sizing
- Tooltips showing exact values

### Dashboard Behavior

#### Auto-refresh
- **Frequency**: Every 30 seconds
- **Indicator**: Visual indicator showing auto-refresh status
- **Manual Refresh**: Button to force immediate update
- **Error Handling**: Pause auto-refresh on repeated failures

#### Loading States
- **Initial Load**: Skeleton placeholders for each widget
- **Refresh**: Subtle loading indicator without hiding data
- **Error State**: Retry button with error message

#### Responsive Design
- **Desktop**: 2x2 grid layout
- **Tablet**: 2x2 grid with adjusted widget heights
- **Mobile**: Single column stack

#### User Interactions
- **Refresh Button**: Manual data refresh
- **Time Range Selection**: Update trends chart
- **Alert Dismissal**: Acknowledge system alerts
- **Navigation**: Click on items to view details

## Task Management

### Task List Page

**Purpose**: Browse and manage available workflow tasks

#### Page Features
- **Task Grid**: Responsive card layout showing task summaries
- **Search**: Text search across task names and descriptions
- **Sorting**: Sort by name, last execution, or success rate
- **Pagination**: Server-side pagination with configurable page size
- **Filtering**: Future implementation for task categories

#### Task Card Information
Each task card displays:
- **Task Name**: Primary identifier or display name
- **Description**: Brief description (truncated if long)
- **Status Badge**: Last execution status (success, failed, running, queued)
- **Success Rate**: Percentage of successful executions
- **Total Runs**: Number of times task has been executed
- **Last Execution**: Relative time since last run
- **Action Button**: Quick run task option

#### User Interactions
- **Click Card**: Navigate to task detail page
- **Search Input**: Filter tasks by text
- **Sort Dropdown**: Change sorting criteria and direction
- **Pagination Controls**: Navigate between pages
- **Page Size Selector**: Change number of items per page
- **Run Task Button**: Execute task with default parameters

### Task Detail Page

**Purpose**: View detailed task information and manage executions

#### Page Sections

##### 1. Task Header
- **Task Name**: Full task name
- **Description**: Complete task description
- **Run Task Button**: Primary action to execute task
- **Last Execution Status**: Latest run result with timestamp
- **Breadcrumb Navigation**: Dashboard > Tasks > [Task Name]

##### 2. Task Statistics
- **Total Executions**: Count of all runs
- **Success Rate**: Percentage with trend indicator
- **Average Duration**: Mean execution time
- **Recent Trend**: Performance trend (improving/declining/stable)
- **Execution Chart**: Historical duration chart over time

##### 3. Task Configuration
- **Input Parameters**: Table of configurable inputs with:
  - Parameter name
  - Data type
  - Default value
  - Description
  - Required/optional flag
- **Flow Steps**: Visual representation of workflow steps
- **Dependencies**: Step dependencies and execution order
- **Error Handling**: Continue-on-fail and retry settings

##### 4. Job History
- **Recent Executions**: Paginated table with:
  - Job ID (clickable link)
  - Start time
  - Duration
  - Status
  - Triggered by (user/schedule/trigger)
- **Filtering**: Filter by execution status
- **Sorting**: Sort by start time, duration, or status

#### User Interactions
- **Run Task**: Open execution dialog with parameter form
- **View Job**: Click job ID to see execution details
- **Filter History**: Filter executions by status
- **Parameter Help**: Tooltips explaining parameter usage

### Task Execution Dialog

**Purpose**: Configure and execute a task

#### Dialog Features
- **Parameter Form**: Dynamic form based on task input schema
- **Validation**: Real-time input validation
- **Default Values**: Pre-populate with configured defaults
- **Help Text**: Parameter descriptions and examples
- **Execution Button**: Submit task for execution
- **Cancel Option**: Close without executing

#### Form Behavior
- **Required Fields**: Mark required parameters clearly
- **Type Validation**: Validate data types (string, number, boolean)
- **Format Validation**: Check formats (email, URL, JSON)
- **Error Display**: Show validation errors inline
- **Success Feedback**: Confirm task submission with job ID

## Job Management

### Job Detail Page

**Purpose**: View detailed information about a specific job execution

#### Page Sections

##### 1. Job Header
- **Job ID**: Unique execution identifier
- **Task Name**: Link to parent task
- **Execution Status**: Current state with appropriate styling
- **Started**: Execution start timestamp
- **Duration**: Total execution time (if completed)
- **Triggered By**: User, schedule, or trigger that initiated job
- **Breadcrumb Navigation**: Dashboard > Jobs > [Job ID]

##### 2. Execution Details
- **Input Parameters**: JSON display of provided inputs
- **Output Data**: Results produced by successful execution
- **Worker Information**: ID of worker that processed the job
- **Git Revision**: Workspace version used for execution
- **Error Information**: Failure details if job failed

##### 3. Execution Logs
- **Real-time Logs**: Live streaming during execution
- **Historical Logs**: Complete log history for completed jobs
- **Log Filtering**: Filter by log level (info, warning, error)
- **Download Option**: Export logs as text file
- **Auto-scroll**: Follow new log entries automatically

##### 4. Step Execution
- **Flow Progress**: Visual representation of workflow steps
- **Step Status**: Individual step success/failure states
- **Step Timing**: Duration for each completed step
- **Step Output**: Intermediate results between steps
- **Error Context**: Which step failed and why

#### User Interactions
- **Refresh**: Update job status and logs
- **Download Logs**: Export execution logs
- **View Task**: Navigate to parent task
- **Retry Job**: Re-execute with same parameters (if failed)
- **Cancel Job**: Stop running execution

### Job List (Future Implementation)

**Purpose**: Browse all job executions across tasks

#### Features
- **Global Job History**: All executions regardless of task
- **Advanced Filtering**: By status, date range, task, user
- **Bulk Operations**: Cancel multiple jobs, export data
- **Real-time Updates**: Live status updates for running jobs

## User Interface Requirements

### Visual Design Principles

#### Layout System
- **Responsive Design**: Mobile-first approach with breakpoints
- **Grid System**: Consistent spacing and alignment
- **Component Hierarchy**: Clear visual hierarchy with typography and spacing
- **White Space**: Adequate spacing for readability

#### Color System
- **Semantic Colors**: Distinct colors for success, error, warning, info states
- **Brand Colors**: Primary color scheme for interactive elements
- **Neutral Palette**: Grays for text, borders, and backgrounds
- **Dark Mode Support**: Complete dark theme with proper contrast ratios

#### Typography
- **Hierarchy**: Clear heading levels (H1-H6) with consistent sizing
- **Readability**: Optimal line height and letter spacing
- **Font Weights**: Regular, medium, semibold, and bold weights
- **Code Display**: Monospace font for code, logs, and data

#### Interactive Elements
- **Button States**: Hover, active, disabled, and loading states
- **Form Elements**: Clear labeling, validation states, and help text
- **Navigation**: Active states and hover feedback
- **Status Indicators**: Color-coded badges and progress indicators

### Component Requirements

#### Basic Components
- **Button**: Multiple variants (primary, secondary, outline, ghost, danger)
- **Card**: Container with optional header, body, and footer sections
- **Input**: Text, number, email, password, and textarea variants
- **Select**: Dropdown with search and multi-select capabilities
- **Badge**: Status indicators with color coding
- **Alert**: Dismissible notifications with different severity levels
- **Table**: Sortable columns, pagination, and row selection
- **Modal**: Overlay dialogs for forms and confirmations
- **Tooltip**: Contextual help on hover/focus
- **Loading**: Spinners, skeletons, and progress indicators

#### Navigation Components
- **Sidebar**: Collapsible navigation with icons and labels
- **Breadcrumb**: Hierarchical navigation trail
- **Pagination**: Page navigation with size selection
- **Tab Navigation**: Tabbed content switching

#### Data Visualization
- **Charts**: Line charts for trends with responsive sizing
- **Metrics**: Number display with trend indicators
- **Progress**: Linear and circular progress indicators
- **Status Grid**: Grid layout for system status display

### Accessibility Requirements

#### Keyboard Navigation
- **Tab Order**: Logical focus flow through interactive elements
- **Keyboard Shortcuts**: Common shortcuts (Escape, Enter, Space)
- **Focus Indicators**: Clear visual focus states
- **Skip Links**: Skip to main content functionality

#### Screen Reader Support
- **ARIA Labels**: Descriptive labels for all interactive elements
- **Semantic HTML**: Proper use of headings, lists, and form elements
- **Live Regions**: Announce dynamic content changes
- **Alternative Text**: Images and icons with descriptive alt text

#### Visual Accessibility
- **Contrast Ratios**: WCAG AA compliance for text and background colors
- **Color Independence**: Information not conveyed by color alone
- **Text Scaling**: Support for 200% zoom without horizontal scrolling
- **Motion**: Respect prefers-reduced-motion settings

## Data Models

### Authentication Models

```typescript
interface User {
  user_id: string;
  email: string;
  name: string | null;
  roles?: string[]; // Future implementation
}

interface AuthResponse {
  access_token: string;
  user: User;
}
```

### Dashboard Models

```typescript
interface SystemStatus {
  active_workers: number;
  idle_workers: number;
  total_jobs_today: number;
  system_uptime: string; // ISO 8601 duration
  average_execution_time_24h: number; // seconds
  alerts: SystemAlert[];
}

interface SystemAlert {
  id: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string; // ISO 8601
  source?: string;
}

interface JobExecutionMetrics {
  today: {
    total_jobs: number;
    success_count: number;
    failure_count: number;
    success_rate: number; // percentage
  };
  status_distribution: {
    running: number;
    completed: number;
    failed: number;
    queued: number;
  };
  top_failing_workflows: Array<{
    workflow_name: string;
    failure_rate: number; // percentage
    total_executions: number;
  }>;
  average_execution_time: number; // seconds
}

interface RecentActivity {
  recent_jobs: RecentJob[];
  alerts: SystemAlert[];
  upcoming_jobs: UpcomingJob[];
}

interface RecentJob {
  job_id: string;
  task_name: string;
  status: ExecutionStatus;
  start_time: string; // ISO 8601
  duration?: number; // seconds
  triggered_by: string;
}

interface UpcomingJob {
  task_name: string;
  scheduled_time: string; // ISO 8601
  trigger_type: string;
  estimated_duration?: number; // seconds
}

interface JobTrendsData {
  time_series: JobTrendsDataPoint[];
  time_range: '1h' | '24h' | '7d' | '30d';
}

interface JobTrendsDataPoint {
  timestamp: string; // ISO 8601
  total_jobs: number;
  successful_jobs: number;
  failed_jobs: number;
}
```

### Task Management Models

```typescript
type ExecutionStatus = 'success' | 'failed' | 'running' | 'queued';

interface Task {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputField>;
  flow: Record<string, FlowStep>;
}

interface InputField {
  id: string;
  type: string;
  default?: any;
  description?: string;
  required?: boolean;
  order?: number;
  name?: string;
  validation?: Record<string, any>;
  examples?: any[];
}

interface FlowStep {
  action: string;
  input?: Record<string, any>;
  depends_on?: string[];
  continue_on_fail?: boolean;
  on_error?: string;
  condition?: string;
}

interface TaskStatistics {
  total_executions: number;
  success_rate: number; // percentage
  last_execution?: LastExecution;
  average_duration?: number; // seconds
  recent_trend?: 'improving' | 'declining' | 'stable';
}

interface LastExecution {
  timestamp: string; // ISO 8601
  status: ExecutionStatus;
  triggered_by: string;
  duration?: number; // seconds
  job_id?: string;
}

interface EnhancedTask extends Task {
  statistics: TaskStatistics;
}
```

### Job Models

```typescript
interface Job {
  job_id: string;
  success?: boolean | null;
  start_datetime?: string; // ISO 8601
  end_datetime?: string; // ISO 8601
  task?: string;
  action?: string;
  input?: any;
  output?: any;
  source_type?: string;
  source_id?: string;
  status?: string;
  revision?: string;
  worker_id?: string;
  duration?: number; // seconds (calculated)
}
```

### API Response Models

```typescript
interface ApiResponse<T> {
  data?: T;
  pagination?: PaginationInfo;
  error?: ApiError;
  success: boolean;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

interface ApiError {
  message: string;
  code?: string;
  details?: Record<string, any>;
}
```

## User Experience Patterns

### Loading States

#### Progressive Loading
- **Skeleton Screens**: Show layout structure while loading content
- **Lazy Loading**: Load components as they become visible
- **Incremental Updates**: Update parts of UI as data becomes available

#### Loading Indicators
- **Inline Spinners**: For button actions and form submissions
- **Page Loading**: Full-page loading for route changes
- **Widget Loading**: Individual widget loading states on dashboard
- **Background Loading**: Subtle indicators for auto-refresh

### Error Handling

#### Error Presentation
- **Inline Errors**: Field-level validation errors in forms
- **Page Errors**: Full-page error states with retry options
- **Toast Notifications**: Temporary error messages for actions
- **Widget Errors**: Component-level errors with retry buttons

#### Error Recovery
- **Retry Mechanisms**: Automatic retry with exponential backoff
- **Manual Retry**: User-initiated retry buttons
- **Fallback Content**: Show cached or default content when possible
- **Graceful Degradation**: Reduce functionality rather than breaking

### User Feedback

#### Success Feedback
- **Toast Notifications**: Confirm successful actions
- **Status Updates**: Real-time status changes
- **Progress Indicators**: Show completion progress
- **Visual Confirmation**: Color and icon changes

#### Interactive Feedback
- **Hover States**: Visual feedback on interactive elements
- **Click Feedback**: Brief visual response to clicks
- **Form Validation**: Real-time validation with clear messaging
- **Navigation Feedback**: Active states and transitions

### Performance Patterns

#### Optimization Strategies
- **Code Splitting**: Load routes and components on demand
- **Image Optimization**: Responsive images with proper formats
- **Caching**: Cache API responses and static assets
- **Debouncing**: Delay search and filter operations

#### Perceived Performance
- **Skeleton Loading**: Show content structure immediately
- **Optimistic Updates**: Show changes before server confirmation
- **Prefetching**: Load likely next pages in background
- **Instant Feedback**: Immediate response to user actions

This functional specification provides comprehensive guidance for reimplementing the Strøm UI using any technology stack while maintaining the same functionality, user experience, and API integration patterns as the original implementation.

