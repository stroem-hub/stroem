# API Response Examples

## Task API Response

The Task API returns paginated responses with the following structure:

```json
{
  "success": true,
  "data": [
    {
      "id": "task1",
      "name": "My Task Name", // or null if no name is set
      "description": "Task description", // optional, can be null
      "input": {
        "field1": {
          "id": "field1",
          "required": true,
          "description": "Field description",
          "order": null,
          "type": "string",
          "default": "default_value"
        }
      },
      "flow": {
        "step1": {
          "id": "step1",
          "name": "Step Name",
          "action": "action.name",
          "input": {
            "param": "value"
          },
          "depends_on": null,
          "continue_on_fail": null,
          "on_error": null
        }
      },
      "statistics": {
        "total_executions": 12,
        "success_count": 8,        // ✅ Direct count from database
        "failure_count": 4,        // ✅ Direct count from database  
        "average_duration": 0.28132375,
        "last_execution": {
          "timestamp": "2025-09-02T12:16:55.069117+00:00",
          "status": "success",
          "triggered_by": "user",
          "duration": 0.488262
        }
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 2,
    "total_pages": 1,
    "has_next": false,
    "has_prev": false
  }
}
```

## Benefits of Using Direct Counts

Using `success_count` and `failure_count` instead of `success_rate` provides:

1. **Accuracy**: No rounding errors from percentage calculations
2. **Simplicity**: Direct display without frontend calculations
3. **Consistency**: Ensures success_count + failure_count = total_executions
4. **Flexibility**: Frontend can still calculate success_rate if needed: `(success_count / total_executions) * 100`

## Frontend Display

With this structure, the TaskCard will display:
- **Title**: Task name (or ID if name is null)
- **Total Runs**: `total_executions`
- **Successful**: `success_count` 
- **Failed**: `failure_count`
- **Success Rate**: Calculated as `(success_count / total_executions) * 100`
- **Average Duration**: `average_duration` (formatted)
- **Last Execution**: Status and duration from `last_execution`