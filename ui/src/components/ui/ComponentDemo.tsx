import { useState } from 'react';
import {
  Table,
  Badge,
  StatusBadge,
  PriorityBadge,
  Modal,
  ConfirmModal,
  Tooltip,
  SimpleTooltip,
  RichTooltip,
  LineChart,
  BarChart,
  DonutChart,
  AreaChart,
  Button,
  Card,
  CardHeader,
  CardContent,
} from './index';

// Demo data
const tableData = [
  { id: 1, name: 'Task 1', status: 'completed', priority: 'high', value: 85 },
  { id: 2, name: 'Task 2', status: 'running', priority: 'medium', value: 92 },
  { id: 3, name: 'Task 3', status: 'failed', priority: 'low', value: 78 },
  { id: 4, name: 'Task 4', status: 'queued', priority: 'critical', value: 95 },
];

const chartData = [
  { label: 'Jan', value: 65 },
  { label: 'Feb', value: 78 },
  { label: 'Mar', value: 90 },
  { label: 'Apr', value: 81 },
  { label: 'May', value: 95 },
];

const timeSeriesData = [
  { timestamp: '2024-01-01', value: 65 },
  { timestamp: '2024-01-02', value: 78 },
  { timestamp: '2024-01-03', value: 90 },
  { timestamp: '2024-01-04', value: 81 },
  { timestamp: '2024-01-05', value: 95 },
  { timestamp: '2024-01-06', value: 88 },
];

const donutData = [
  { label: 'Completed', value: 45, color: '#10b981' },
  { label: 'Running', value: 25, color: '#3b82f6' },
  { label: 'Failed', value: 15, color: '#ef4444' },
  { label: 'Queued', value: 15, color: '#f59e0b' },
];

export function ComponentDemo() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const tableColumns = [
    { key: 'name', header: 'Name', sortable: true },
    { 
      key: 'status', 
      header: 'Status', 
      render: (value: string) => <StatusBadge status={value} />
    },
    { 
      key: 'priority', 
      header: 'Priority', 
      render: (value: string) => <PriorityBadge priority={value as any} />
    },
    { key: 'value', header: 'Value', sortable: true },
  ];

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900">UI Components Demo</h1>

      {/* Badges */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Badges</h2>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Badge variant="default">Default</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warning">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="info">Info</Badge>
            </div>
            
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="completed" />
              <StatusBadge status="running" />
              <StatusBadge status="failed" />
              <StatusBadge status="queued" />
            </div>
            
            <div className="flex flex-wrap gap-2">
              <PriorityBadge priority="low" />
              <PriorityBadge priority="medium" />
              <PriorityBadge priority="high" />
              <PriorityBadge priority="critical" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Table</h2>
        </CardHeader>
        <CardContent>
          <Table
            data={tableData}
            columns={tableColumns}
            sortable
            pagination={{
              page: 1,
              pageSize: 10,
              total: tableData.length,
              onPageChange: (page) => console.log('Page changed:', page),
            }}
          />
        </CardContent>
      </Card>

      {/* Tooltips */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Tooltips</h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <SimpleTooltip text="This is a simple tooltip">
              <Button variant="outline">Hover for simple tooltip</Button>
            </SimpleTooltip>
            
            <RichTooltip 
              title="Rich Tooltip" 
              description="This tooltip has a title and description with more detailed information."
            >
              <Button variant="outline">Hover for rich tooltip</Button>
            </RichTooltip>
            
            <Tooltip content="Custom placement" placement="right">
              <Button variant="outline">Right tooltip</Button>
            </Tooltip>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Modals</h2>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={() => setIsModalOpen(true)}>
              Open Modal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setIsConfirmOpen(true)}
            >
              Open Confirm Modal
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Charts */}
      <Card>
        <CardHeader>
          <h2 className="text-xl font-semibold">Charts</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-medium mb-4">Line Chart</h3>
              <LineChart data={timeSeriesData} showDots showGrid />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Bar Chart</h3>
              <BarChart data={chartData} />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Area Chart</h3>
              <AreaChart data={timeSeriesData} />
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-4">Donut Chart</h3>
              <DonutChart data={donutData} showLegend />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal Components */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Example Modal"
        size="md"
      >
        <div className="p-6">
          <p className="text-gray-600 mb-4">
            This is an example modal with proper focus management and accessibility features.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          console.log('Confirmed!');
          setIsConfirmOpen(false);
        }}
        title="Confirm Action"
        message="Are you sure you want to perform this action? This cannot be undone."
        variant="danger"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}