# Requirements Document

## Introduction

The dashboard widgets are displaying empty or zero values despite the API returning the correct data. This issue stems from a mismatch between the data structure returned by the backend API and what the frontend dashboard widgets expect to receive. The widgets are not properly parsing or accessing the nested data structures, resulting in undefined values being displayed as zeros or empty states.

## Requirements

### Requirement 1

**User Story:** As a system administrator, I want the dashboard to display accurate real-time metrics, so that I can monitor system health and performance effectively.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the system status widget SHALL display correct values for active workers, idle workers, total jobs today, and system uptime
2. WHEN the API returns system status data THEN the widget SHALL properly parse and display the nested data structure
3. WHEN system alerts exist THEN they SHALL be displayed with correct severity levels and timestamps
4. IF the API returns null or undefined values THEN the widget SHALL display appropriate fallback values or "N/A" indicators

### Requirement 2

**User Story:** As a system administrator, I want the job execution metrics widget to show accurate statistics, so that I can understand job performance and identify issues.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the job metrics widget SHALL display correct values for total jobs, success rate, failure rate, and average execution time
2. WHEN the API returns job metrics data THEN the widget SHALL properly access the nested `today` object properties
3. WHEN status distribution data exists THEN it SHALL be displayed with correct counts for running, completed, failed, and queued jobs
4. WHEN top failing workflows exist THEN they SHALL be displayed with correct failure rates and execution counts
5. IF no failing workflows exist THEN the widget SHALL display a positive "all workflows performing well" message

### Requirement 3

**User Story:** As a system administrator, I want the recent activity widget to show current job executions and alerts, so that I can track system activity in real-time.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the recent activity widget SHALL display recent jobs with correct status, timestamps, and duration information
2. WHEN recent jobs data exists THEN each job SHALL display proper status icons, task names, and execution details
3. WHEN upcoming jobs are scheduled THEN they SHALL be displayed with correct scheduling information and estimated durations
4. WHEN system alerts exist THEN they SHALL be integrated into the activity feed with proper severity indicators
5. IF no recent activity exists THEN the widget SHALL display appropriate empty state messages

### Requirement 4

**User Story:** As a system administrator, I want the job trends widget to display execution patterns over time, so that I can analyze system performance trends.

#### Acceptance Criteria

1. WHEN the dashboard loads THEN the trends widget SHALL display time-series data for the selected time range
2. WHEN time range is changed THEN the widget SHALL update to show data for the new range (1h, 24h, 7d, 30d)
3. WHEN trends data exists THEN it SHALL be properly formatted for chart visualization
4. WHEN API returns timestamp data THEN it SHALL be correctly parsed and displayed in the chart
5. IF no trends data exists for the selected range THEN the widget SHALL display an appropriate message

### Requirement 5

**User Story:** As a developer, I want consistent error handling across all dashboard widgets, so that API failures are gracefully handled and users receive clear feedback.

#### Acceptance Criteria

1. WHEN an API call fails THEN the widget SHALL display an error state with retry functionality
2. WHEN data is loading THEN the widget SHALL display appropriate loading skeletons
3. WHEN API returns malformed data THEN the widget SHALL handle the error gracefully without crashing
4. WHEN retry is attempted THEN the widget SHALL clear previous errors and attempt to reload data
5. IF authentication fails THEN the widget SHALL redirect to login or display appropriate auth error