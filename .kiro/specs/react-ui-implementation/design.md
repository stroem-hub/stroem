# Design Document

## Overview

This design outlines the creation of a modern React-based user interface for the Strøm orchestration platform. The new UI will replace the existing SvelteKit implementation while maintaining compatibility with the current backend API. The design emphasizes modern React patterns, responsive design, and real-time data updates.

## Architecture

### Technology Stack
- **Frontend Framework**: React 19.1.1 with TypeScript
- **Styling**: TailwindCSS 4.1.13 for utility-first styling
- **Build Tool**: Vite for fast development and optimized builds
- **Package Manager**: pnpm for efficient dependency management
- **State Management**: React Context API with custom hooks for global state
- **HTTP Client**: Fetch API with custom wrapper for authentication
- **Real-time Communication**: Server-Sent Events (SSE) for job monitoring
- **Routing**: React Router v7.9.1 for client-side navigation
- **Deployment**: Static site generation for embedding in Rust server

### Project Structure
```
ui/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Basic UI primitives (Button, Input, etc.)
│   │   ├── layout/         # Layout components (Sidebar, Header)
│   │   └── widgets/        # Dashboard widgets
│   ├── pages/              # Page components
│   ├── hooks/              # Custom React hooks
│   ├── services/           # API service layer
│   ├── contexts/           # React contexts for global state
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── styles/             # Global styles and Tailwind config
├── public/                 # Static assets
└── package.json
```

## Components and Interfaces

### Core Components

#### Authentication Components
- **LoginForm**: Handles both internal and OIDC authentication
- **AuthProvider**: Context provider for authentication state
- **ProtectedRoute**: Route wrapper for authenticated pages

#### Layout Components
- **AppLayout**: Main application layout with sidebar and content area
- **Sidebar**: Navigation sidebar with collapsible functionality
- **Header**: Top navigation bar with user menu and actions

#### Dashboard Components
- **DashboardPage**: Main dashboard container
- **SystemStatusWidget**: Displays system health and worker status
- **JobMetricsWidget**: Shows job execution statistics
- **RecentActivityWidget**: Lists recent job executions and alerts
- **JobTrendsWidget**: Interactive chart showing job execution trends

#### Task Management Components
- **TasksPage**: Task listing and management interface
- **TaskCard**: Individual task display component
- **TaskDetail**: Detailed task view with execution options
- **TaskExecutionButton**: Button to trigger task execution

#### Job Monitoring Components
- **JobsPage**: Job listing and filtering interface
- **JobCard**: Individual job display component
- **JobDetail**: Detailed job view with logs
- **LogViewer**: Real-time log streaming component

### API Service Layer

#### Authentication Service
```typescript
interface AuthService {
  login(providerId: string, credentials: LoginCredentials): Promise<AuthResponse>
  refreshToken(): Promise<boolean>
  logout(): void
  getCurrentUser(): User | null
}
```

#### API Client
```typescript
interface ApiClient {
  get<T>(url: string): Promise<ApiResponse<T>>
  post<T>(url: string, data: any): Promise<ApiResponse<T>>
  put<T>(url: string, data: any): Promise<ApiResponse<T>>
  delete<T>(url: string): Promise<ApiResponse<T>>
}
```

#### Dashboard Service
```typescript
interface DashboardService {
  getSystemStatus(): Promise<SystemStatus>
  getJobMetrics(): Promise<JobExecutionMetrics>
  getRecentActivity(): Promise<RecentActivity>
  getJobTrends(range: TimeRange): Promise<JobTrendsData>
}
```

#### Task Service
```typescript
interface TaskService {
  getTasks(params: TaskListParams): Promise<PaginatedResponse<Task>>
  getTask(taskId: string): Promise<Task>
  getTaskJobs(taskId: string, params: JobListParams): Promise<PaginatedResponse<Job>>
  executeTask(taskId: string): Promise<string>
}
```

#### Job Service
```typescript
interface JobService {
  getJobs(): Promise<Job[]>
  getJob(jobId: string): Promise<Job>
  getJobLogs(jobId: string): Promise<LogEntry[]>
  subscribeToJobUpdates(jobId: string): EventSource
}
```

## Data Models

### Core Types
```typescript
interface User {
  user_id: string
  email: string
  name: string | null
}

interface Task {
  id: string
  name: string
  description?: string
  statistics: TaskStatistics
}

interface Job {
  id: string
  task_name: string
  status: 'queued' | 'running' | 'completed' | 'failed'
  start_datetime: string
  end_datetime?: string
  duration?: number
  triggered_by: string
}

interface LogEntry {
  timestamp: string
  level: string
  message: string
  step_name?: string
}
```

### Dashboard Types
```typescript
interface SystemStatus {
  active_workers: number
  idle_workers: number
  total_jobs_today: number
  system_uptime: string
  average_execution_time_24h: number
  alerts: Alert[]
}

interface JobExecutionMetrics {
  today: {
    total_jobs: number
    success_count: number
    failure_count: number
    success_rate: number
  }
  status_distribution: {
    running: number
    completed: number
    failed: number
    queued: number
  }
  top_failing_workflows: FailingWorkflow[]
  average_execution_time: number
}
```

## Error Handling

### Error Boundaries
- **GlobalErrorBoundary**: Catches and displays application-level errors
- **PageErrorBoundary**: Handles page-specific errors with retry options
- **ComponentErrorBoundary**: Wraps individual components for isolated error handling

### Error Types
```typescript
interface ApiError {
  message: string
  code?: string
  details?: any
}

interface AppError {
  type: 'network' | 'auth' | 'validation' | 'server'
  message: string
  recoverable: boolean
}
```

### Error Handling Strategy
- Network errors: Automatic retry with exponential backoff
- Authentication errors: Automatic token refresh, redirect to login if failed
- Validation errors: Display inline error messages
- Server errors: Show user-friendly error messages with retry options

## Testing Strategy

### Unit Testing
- **Components**: Test rendering, props, and user interactions
- **Hooks**: Test custom hook logic and state management
- **Services**: Test API calls and data transformation
- **Utils**: Test utility functions and helpers

### Integration Testing
- **Authentication Flow**: Test login, token refresh, and logout
- **API Integration**: Test service layer integration with mock API
- **Navigation**: Test routing and page transitions

### End-to-End Testing
- **User Workflows**: Test complete user journeys
- **Real-time Features**: Test SSE connections and live updates
- **Error Scenarios**: Test error handling and recovery

## Performance Considerations

### Optimization Strategies
- **Code Splitting**: Lazy load pages and heavy components
- **Memoization**: Use React.memo and useMemo for expensive operations
- **Virtual Scrolling**: For large lists of jobs and logs
- **Debouncing**: For search and filter inputs
- **Caching**: Cache API responses with appropriate TTL

### Bundle Optimization
- **Tree Shaking**: Remove unused code
- **Asset Optimization**: Compress images and optimize fonts
- **Chunk Splitting**: Separate vendor and application code

## Security Considerations

### Authentication Security
- **JWT Storage**: Store tokens in memory, use HTTP-only cookies for refresh tokens
- **Token Expiration**: Implement automatic token refresh
- **CSRF Protection**: Include CSRF tokens in state-changing requests

### API Security
- **Request Validation**: Validate all user inputs
- **Error Sanitization**: Don't expose sensitive information in error messages
- **Rate Limiting**: Implement client-side rate limiting for API calls

## Accessibility

### WCAG Compliance
- **Keyboard Navigation**: Full keyboard accessibility
- **Screen Reader Support**: Proper ARIA labels and roles
- **Color Contrast**: Meet WCAG AA contrast requirements
- **Focus Management**: Proper focus handling for modals and navigation

### Responsive Design
- **Mobile First**: Design for mobile devices first
- **Breakpoints**: Support for tablet and desktop layouts
- **Touch Targets**: Appropriate touch target sizes for mobile

## Real-time Features

### Server-Sent Events
- **Job Monitoring**: Real-time job status updates
- **Log Streaming**: Live log updates during job execution
- **Connection Management**: Handle connection drops and reconnection

### WebSocket Alternative
- While the current backend uses SSE, the design allows for future WebSocket implementation for bidirectional communication

## Migration Strategy

### Compatibility
- **API Compatibility**: Maintain full compatibility with existing backend APIs
- **Feature Parity**: Implement all features from the legacy SvelteKit UI
- **Data Migration**: No data migration required as backend remains unchanged

### Deployment
- **Static Build**: Generate static assets using Vite build process
- **Rust Integration**: Embed static files in Rust server using `include_dir!` macro
- **Asset Serving**: Serve static assets from `/static/` route in Axum server
- **Side-by-Side**: Deploy new UI alongside legacy UI for testing
- **Feature Flags**: Use feature flags to gradually roll out new UI
- **Rollback Plan**: Maintain ability to quickly rollback to legacy UI

### Build Process
- **Development**: `pnpm dev` for hot-reload development server
- **Production**: `pnpm build` generates optimized static assets in `dist/` folder
- **Integration**: Rust server includes `ui/dist/` contents at compile time
- **Serving**: Static files served from embedded assets, API routes remain unchanged