
import { JobTrendsWidget } from '../JobTrendsWidget';

/**
 * Example usage of JobTrendsWidget
 */
export function JobTrendsWidgetExample() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Job Trends Widget Examples</h2>
        
        {/* Default Configuration */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Default Configuration</h3>
          <p className="text-gray-600 mb-4">
            Shows job trends with default 24-hour range, auto-refresh every minute, and success/failure comparison.
          </p>
          <JobTrendsWidget />
        </div>

        {/* Custom Time Range */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Custom Default Range</h3>
          <p className="text-gray-600 mb-4">
            Widget starting with 7-day view by default.
          </p>
          <JobTrendsWidget 
            defaultRange="7d"
          />
        </div>

        {/* No Success/Failure Chart */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Total Jobs Only</h3>
          <p className="text-gray-600 mb-4">
            Shows only total job trends without success/failure breakdown.
          </p>
          <JobTrendsWidget 
            showSuccessFailure={false}
          />
        </div>

        {/* Custom Refresh Interval */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Custom Refresh Interval</h3>
          <p className="text-gray-600 mb-4">
            Faster refresh interval (30 seconds) for more real-time updates.
          </p>
          <JobTrendsWidget 
            refreshInterval={30000}
          />
        </div>

        {/* No Auto-refresh */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Manual Refresh Only</h3>
          <p className="text-gray-600 mb-4">
            Disabled auto-refresh for manual control.
          </p>
          <JobTrendsWidget 
            refreshInterval={0}
          />
        </div>

        {/* Custom Styling */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Custom Styling</h3>
          <p className="text-gray-600 mb-4">
            Widget with custom CSS classes.
          </p>
          <JobTrendsWidget 
            className="border-2 border-green-200 shadow-lg"
          />
        </div>
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-semibold mb-4">Usage Code</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// Basic usage
<JobTrendsWidget />

// With custom configuration
<JobTrendsWidget 
  defaultRange="7d"           // Start with 7-day view
  refreshInterval={30000}     // 30 seconds refresh
  showSuccessFailure={false}  // Hide success/failure chart
  className="custom-class"
/>

// Manual refresh only
<JobTrendsWidget 
  refreshInterval={0}
/>`}
        </pre>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Props</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white border border-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Prop</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Default</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-4 py-2 text-sm font-mono">className</td>
                <td className="px-4 py-2 text-sm">string</td>
                <td className="px-4 py-2 text-sm">''</td>
                <td className="px-4 py-2 text-sm">Additional CSS classes</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono">refreshInterval</td>
                <td className="px-4 py-2 text-sm">number</td>
                <td className="px-4 py-2 text-sm">60000</td>
                <td className="px-4 py-2 text-sm">Auto-refresh interval in milliseconds (0 to disable)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono">defaultRange</td>
                <td className="px-4 py-2 text-sm">TimeRange</td>
                <td className="px-4 py-2 text-sm">'24h'</td>
                <td className="px-4 py-2 text-sm">Default time range ('1h' | '6h' | '24h' | '7d' | '30d')</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono">showSuccessFailure</td>
                <td className="px-4 py-2 text-sm">boolean</td>
                <td className="px-4 py-2 text-sm">true</td>
                <td className="px-4 py-2 text-sm">Whether to show success/failure comparison chart</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-lg font-semibold mb-4">Time Range Options</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-mono text-sm">'1h'</div>
            <div className="text-xs text-gray-600">1 Hour</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-mono text-sm">'6h'</div>
            <div className="text-xs text-gray-600">6 Hours</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-mono text-sm">'24h'</div>
            <div className="text-xs text-gray-600">24 Hours</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-mono text-sm">'7d'</div>
            <div className="text-xs text-gray-600">7 Days</div>
          </div>
          <div className="bg-gray-50 p-3 rounded">
            <div className="font-mono text-sm">'30d'</div>
            <div className="text-xs text-gray-600">30 Days</div>
          </div>
        </div>
      </div>
    </div>
  );
}