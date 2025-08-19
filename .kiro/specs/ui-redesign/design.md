# Design Document

## Overview

The UI redesign will transform the Strøm orchestration platform from a Flowbite-dependent interface to a modern, custom-built system with enhanced functionality. The design emphasizes clean aesthetics, intuitive navigation, comprehensive dashboard capabilities, and maintainable component architecture. The new system will leverage TailwindCSS for styling while building custom components that provide better control over design consistency and functionality.

## Architecture


### Core Dependencies
- Svelte v5
- TailwindCSS v4.1
- Vite for building

### Component Architecture
- **Atomic Design Pattern**: Components organized into atoms (basic elements), molecules (simple combinations), organisms (complex components), templates (page layouts), and pages
- **Headless Component Approach**: Unstyled, accessible base components with separate styling layers
- **Composition over Inheritance**: Components built through composition for maximum flexibility
- **TypeScript-First**: All components fully typed with proper interfaces and generics

### State Management
- **Svelte Stores**: Reactive stores for global state (auth, theme, notifications)
- **Local Component State**: Svelte's built-in reactivity for component-specific state
- **API State**: Custom stores for caching API responses with automatic invalidation
- **Real-time Updates**: WebSocket integration for live job status and log streaming

### Styling System
- **TailwindCSS 4.x**: Utility-first CSS framework for consistent styling
- **CSS Custom Properties**: Design tokens for colors, spacing, typography, and shadows
- **Component Variants**: Systematic approach to component variations (size, color, state)
- **Dark/Light Theme**: CSS custom properties-based theme switching

## Components and Interfaces

### Design System Foundation

#### Color Palette
```css
:root {
  /* Primary Colors */
  --color-primary-50: #f0f9ff;
  --color-primary-100: #e0f2fe;
  --color-primary-500: #0ea5e9;
  --color-primary-600: #0284c7;
  --color-primary-700: #0369a1;
  
  /* Neutral Colors */
  --color-gray-50: #f9fafb;
  --color-gray-100: #f3f4f6;
  --color-gray-500: #6b7280;
  --color-gray-700: #374151;
  --color-gray-900: #111827;
  
  /* Status Colors */
  --color-success: #10b981;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --color-info: #3b82f6;
}
```

#### Typography Scale
- **Headings**: Inter font family with weights 400, 500, 600, 700
- **Body Text**: Inter font family with weights 400, 500
- **Code**: JetBrains Mono for code blocks and technical content
- **Scale**: 12px, 14px, 16px, 18px, 20px, 24px, 30px, 36px, 48px

### Core Components

#### Button Component
```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: ComponentType;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  onClick?: () => void;
  children: Snippet;
}
```

#### Card Component
```typescript
interface CardProps {
  variant?: 'default' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: Snippet;
  footer?: Snippet;
  children: Snippet;
}
```

#### Table Component
```typescript
interface TableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  sortable?: boolean;
  filterable?: boolean;
  pagination?: PaginationConfig;
  loading?: boolean;
  emptyState?: Snippet;
  onRowClick?: (row: T) => void;
}

interface TableColumn<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  filterable?: boolean;
  render?: (value: T[keyof T], row: T) => Snippet;
  width?: string;
}
```

#### Form Components
```typescript
interface InputProps {
  type: 'text' | 'email' | 'password' | 'number' | 'search';
  label?: string;
  placeholder?: string;
  value?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  helperText?: string;
  icon?: ComponentType;
  onInput?: (value: string) => void;
}

interface SelectProps<T> {
  options: SelectOption<T>[];
  value?: T;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  searchable?: boolean;
  multiple?: boolean;
  onChange?: (value: T | T[]) => void;
}
```

### Layout Components

#### Sidebar Navigation
```typescript
interface SidebarProps {
  collapsed?: boolean;
  onToggle?: (collapsed: boolean) => void;
  items: NavigationItem[];
  user?: User;
  onLogout?: () => void;
}

interface NavigationItem {
  id: string;
  label: string;
  icon: ComponentType;
  href?: string;
  children?: NavigationItem[];
  badge?: string | number;
  active?: boolean;
}
```

#### Page Layout
```typescript
interface PageLayoutProps {
  title?: string;
  subtitle?: string;
  breadcrumbs?: Breadcrumb[];
  actions?: Snippet;
  children: Snippet;
}

interface Breadcrumb {
  label: string;
  href?: string;
}
```

### Dashboard Components

#### Metric Card
```typescript
interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    type: 'increase' | 'decrease';
    period: string;
  };
  icon?: ComponentType;
  color?: 'blue' | 'green' | 'yellow' | 'red';
  loading?: boolean;
}
```

#### Chart Components
```typescript
interface LineChartProps {
  data: ChartDataPoint[];
  xAxis: string;
  yAxis: string;
  color?: string;
  height?: number;
  loading?: boolean;
}

interface ChartDataPoint {
  [key: string]: string | number | Date;
}
```

#### Activity Feed
```typescript
interface ActivityFeedProps {
  items: ActivityItem[];
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

interface ActivityItem {
  id: string;
  type: 'job_started' | 'job_completed' | 'job_failed' | 'task_created';
  title: string;
  description?: string;
  timestamp: Date;
  user?: string;
  metadata?: Record<string, any>;
}
```

## Data Models

### API Response Types
```typescript
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

interface Job {
  job_id: string;
  task?: string;
  action?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  success?: boolean;
  start_datetime?: string;
  end_datetime?: string;
  input?: any;
  output?: any;
  steps: JobStep[];
  worker_id?: string;
  source_type?: string;
  source_id?: string;
  revision?: string;
}

interface Task {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputField>;
  flow: any;
  tags?: string[];
  last_run?: string;
  success_rate?: number;
}

interface Action {
  id: string;
  name?: string;
  description?: string;
  input?: Record<string, InputField>;
  output_schema?: any;
  examples?: ActionExample[];
}

interface Trigger {
  id: string;
  name?: string;
  description?: string;
  type: 'cron' | 'webhook' | 'manual';
  schedule?: string;
  enabled: boolean;
  last_triggered?: string;
  next_trigger?: string;
  associated_tasks: string[];
}
```

### Dashboard Data Models
```typescript
interface DashboardMetrics {
  total_jobs: number;
  running_jobs: number;
  success_rate: number;
  avg_execution_time: number;
  active_workers: number;
  total_tasks: number;
  recent_activity: ActivityItem[];
  job_trends: ChartDataPoint[];
  execution_times: ChartDataPoint[];
}

interface SystemHealth {
  status: 'healthy' | 'warning' | 'critical';
  uptime: number;
  memory_usage: number;
  cpu_usage: number;
  disk_usage: number;
  database_status: 'connected' | 'disconnected';
  worker_status: WorkerStatus[];
}

interface WorkerStatus {
  worker_id: string;
  status: 'online' | 'offline' | 'busy';
  last_seen: string;
  current_job?: string;
  total_jobs_completed: number;
}
```

## Error Handling

### Error Boundary Component
```typescript
interface ErrorBoundaryProps {
  fallback?: Snippet;
  onError?: (error: Error) => void;
  children: Snippet;
}
```

### Error Display Patterns
- **Inline Errors**: Field-level validation errors with clear messaging
- **Toast Notifications**: Non-blocking notifications for actions and system events
- **Error Pages**: Full-page error states for critical failures
- **Loading States**: Skeleton loaders and progress indicators for async operations

### Error Recovery
- **Retry Mechanisms**: Automatic retry for failed API requests with exponential backoff
- **Offline Handling**: Graceful degradation when network is unavailable
- **Validation**: Client-side validation with server-side confirmation
- **User Feedback**: Clear error messages with suggested actions

## Testing Strategy

### Component Testing
- **Unit Tests**: Individual component behavior and props handling
- **Integration Tests**: Component interaction and data flow
- **Visual Regression Tests**: Screenshot comparison for UI consistency
- **Accessibility Tests**: Automated a11y testing with axe-core

### End-to-End Testing
- **User Flows**: Critical paths like task execution and job monitoring
- **Cross-browser Testing**: Compatibility across modern browsers
- **Responsive Testing**: Layout behavior across different screen sizes
- **Performance Testing**: Load times and runtime performance metrics

### Testing Tools
- **Vitest**: Unit and integration testing framework
- **Testing Library**: Component testing utilities
- **Playwright**: End-to-end testing framework
- **Storybook**: Component development and visual testing

## Performance Considerations

### Optimization Strategies
- **Code Splitting**: Route-based and component-based lazy loading
- **Bundle Analysis**: Regular monitoring of bundle size and dependencies
- **Image Optimization**: WebP format with fallbacks and lazy loading
- **Caching**: Aggressive caching of static assets and API responses

### Real-time Features
- **WebSocket Management**: Connection pooling and automatic reconnection
- **Efficient Updates**: Minimal DOM updates using Svelte's reactivity
- **Memory Management**: Proper cleanup of subscriptions and event listeners
- **Throttling**: Rate limiting for real-time updates to prevent UI blocking

### Accessibility
- **Semantic HTML**: Proper heading hierarchy and landmark elements
- **ARIA Labels**: Comprehensive labeling for screen readers
- **Keyboard Navigation**: Full keyboard accessibility with focus management
- **Color Contrast**: WCAG AA compliant color combinations
- **Motion Preferences**: Respect for reduced motion preferences