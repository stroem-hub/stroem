# SystemStatusWidget

A React component that displays real-time system status information for the Strøm orchestration platform.

## Features

- **Real-time Updates**: Automatically refreshes system status data at configurable intervals
- **Worker Status**: Shows active and idle worker counts with visual indicators
- **System Uptime**: Displays system uptime with online status indicator
- **Job Statistics**: Shows today's job count and average execution time
- **System Alerts**: Displays system notifications with appropriate severity levels
- **Error Handling**: Comprehensive error handling with retry functionality
- **Loading States**: Skeleton loading animations during data fetching
- **Responsive Design**: Works on desktop, tablet, and mobile devices

## Usage

### Basic Usage

```tsx
import { SystemStatusWidget } from '../components/widgets';

function Dashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <SystemStatusWidget />
    </div>
  );
}
```

### With Custom Configuration

```tsx
import { SystemStatusWidget } from '../components/widgets';
import type { AppError } from '../types';

function Dashboard() {
  const handleError = (error: AppError) => {
    console.error('System status error:', error);
    // Handle error (e.g., show toast notification)
  };

  return (
    <SystemStatusWidget
      refreshInterval={15000} // Refresh every 15 seconds
      onError={handleError}
      className="custom-widget-class"
    />
  );
}
```

### Disable Auto-refresh

```tsx
<SystemStatusWidget refreshInterval={0} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `undefined` | Additional CSS classes to apply to the widget |
| `refreshInterval` | `number` | `30000` | Auto-refresh interval in milliseconds. Set to 0 to disable |
| `onError` | `(error: AppError) => void` | `undefined` | Callback function called when an error occurs |

## Data Structure

The widget displays data from the `SystemStatus` interface:

```typescript
interface SystemStatus {
  active_workers: number;
  idle_workers: number;
  total_jobs_today: number;
  system_uptime: string;
  average_execution_time_24h: number;
  alerts: Alert[];
}

interface Alert {
  id: string;
  type: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
}
```

## Features in Detail

### Worker Status Display

- Shows total worker count (active + idle)
- Visual indicators for active (green) and idle (gray) workers
- Real-time updates as workers come online/offline

### System Uptime

- Displays formatted uptime string (e.g., "2d 14h 32m")
- Shows online status with animated green indicator
- Updates automatically with system status

### Job Statistics

- Today's total job count
- Average execution time formatted appropriately:
  - Seconds: "30.5s"
  - Minutes: "2.1m" 
  - Hours: "1.0h"

### System Alerts

- Displays up to recent system alerts
- Color-coded by severity (info/warning/error)
- Shows alert timestamp
- Scrollable list for multiple alerts
- "No system alerts" message when none exist

### Error Handling

- Displays user-friendly error messages
- Retry button for recoverable errors
- Automatic retry with exponential backoff
- Graceful degradation on API failures

### Loading States

- Skeleton animations during initial load
- Spinner indicators during refresh operations
- Non-blocking refresh (data remains visible)

## Styling

The widget uses TailwindCSS classes and follows the design system:

- Card-based layout with shadow and border
- Consistent spacing and typography
- Responsive grid layout
- Accessible color contrast
- Hover and focus states

## Accessibility

- Proper ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader compatible
- Color contrast meets WCAG AA standards
- Focus management for refresh button

## Performance

- Efficient caching with TTL (30 seconds default)
- Debounced refresh operations
- Minimal re-renders with React.memo patterns
- Cleanup of intervals on unmount

## Error Recovery

The widget implements several error recovery strategies:

1. **Automatic Retry**: Failed requests are retried with exponential backoff
2. **Cache Fallback**: Shows cached data during temporary failures
3. **Manual Retry**: User can manually retry failed requests
4. **Graceful Degradation**: Partial failures don't break the entire widget

## Testing

The component includes comprehensive tests:

- Unit tests for individual functions
- Integration tests for data loading
- Error handling scenarios
- Loading state verification
- Accessibility testing

Run tests with:

```bash
npm test -- SystemStatusWidget
```

## Dependencies

- React 19.1.1+
- TailwindCSS 4.1.13+
- Dashboard Service (internal)
- UI Components (Card, Button, Alert, Loading)

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Related Components

- `JobMetricsWidget` - Job execution statistics
- `RecentActivityWidget` - Recent jobs and alerts
- `JobTrendsWidget` - Job execution trends over time