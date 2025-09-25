
import { RecentActivityWidget } from '../RecentActivityWidget';

/**
 * Example usage of RecentActivityWidget
 */
export function RecentActivityWidgetExample() {
  return (
    <div className="space-y-8 p-6">
      <div>
        <h2 className="text-2xl font-bold mb-4">Recent Activity Widget Examples</h2>
        
        {/* Default Configuration */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Default Configuration</h3>
          <p className="text-gray-600 mb-4">
            Shows recent jobs and alerts with default refresh interval (30 seconds) and max items (10).
          </p>
          <div className="max-w-md">
            <RecentActivityWidget />
          </div>
        </div>

        {/* Custom Configuration */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Custom Configuration</h3>
          <p className="text-gray-600 mb-4">
            Custom refresh interval (15 seconds) and limited to 5 items.
          </p>
          <div className="max-w-md">
            <RecentActivityWidget 
              refreshInterval={15000}
              maxItems={5}
            />
          </div>
        </div>

        {/* No Auto-refresh */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">No Auto-refresh</h3>
          <p className="text-gray-600 mb-4">
            Disabled auto-refresh (manual refresh only).
          </p>
          <div className="max-w-md">
            <RecentActivityWidget 
              refreshInterval={0}
            />
          </div>
        </div>

        {/* Custom Styling */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-2">Custom Styling</h3>
          <p className="text-gray-600 mb-4">
            Widget with custom CSS classes.
          </p>
          <div className="max-w-md">
            <RecentActivityWidget 
              className="border-2 border-blue-200 shadow-lg"
            />
          </div>
        </div>
      </div>

      <div className="mt-12">
        <h3 className="text-lg font-semibold mb-4">Usage Code</h3>
        <pre className="bg-gray-100 p-4 rounded-lg overflow-x-auto text-sm">
{`// Basic usage
<RecentActivityWidget />

// With custom configuration
<RecentActivityWidget 
  refreshInterval={15000}  // 15 seconds
  maxItems={5}            // Show max 5 items
  className="custom-class"
/>

// Disable auto-refresh
<RecentActivityWidget 
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
                <td className="px-4 py-2 text-sm">30000</td>
                <td className="px-4 py-2 text-sm">Auto-refresh interval in milliseconds (0 to disable)</td>
              </tr>
              <tr>
                <td className="px-4 py-2 text-sm font-mono">maxItems</td>
                <td className="px-4 py-2 text-sm">number</td>
                <td className="px-4 py-2 text-sm">10</td>
                <td className="px-4 py-2 text-sm">Maximum number of items to display</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}