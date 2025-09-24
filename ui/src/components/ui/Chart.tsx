// Base chart types
export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

// Line Chart Component
export interface LineChartProps {
  data: TimeSeriesDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  showDots?: boolean;
  showGrid?: boolean;
  className?: string;
}

export function LineChart({
  data,
  width = 400,
  height = 200,
  color = '#3b82f6',
  strokeWidth = 2,
  showDots = false,
  showGrid = true,
  className = '',
}: LineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ width, height }}>
        <span className="text-gray-500 text-sm">No data available</span>
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, ...point };
  });

  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  return (
    <div className={className}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-300" stroke="currentColor" strokeWidth="1" opacity="0.3">
            {/* Horizontal grid lines */}
            {Array.from({ length: 5 }, (_, i) => {
              const y = padding + (i / 4) * chartHeight;
              return (
                <line key={`h-${i}`} x1={padding} y1={y} x2={padding + chartWidth} y2={y} />
              );
            })}
            {/* Vertical grid lines */}
            {Array.from({ length: 5 }, (_, i) => {
              const x = padding + (i / 4) * chartWidth;
              return (
                <line key={`v-${i}`} x1={x} y1={padding} x2={x} y2={padding + chartHeight} />
              );
            })}
          </g>
        )}

        {/* Chart line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {showDots && points.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r="4"
            fill={color}
            stroke="white"
            strokeWidth="2"
          />
        ))}

        {/* Y-axis labels */}
        <g className="text-xs fill-gray-600">
          {Array.from({ length: 5 }, (_, i) => {
            const value = maxValue - (i / 4) * valueRange;
            const y = padding + (i / 4) * chartHeight;
            return (
              <text key={i} x={padding - 10} y={y + 4} textAnchor="end">
                {value.toFixed(0)}
              </text>
            );
          })}
        </g>

        {/* X-axis labels */}
        <g className="text-xs fill-gray-600">
          {points.filter((_, i) => i % Math.ceil(points.length / 4) === 0).map((point, index) => (
            <text key={index} x={point.x} y={height - 10} textAnchor="middle">
              {new Date(point.timestamp).toLocaleDateString()}
            </text>
          ))}
        </g>
      </svg>
    </div>
  );
}

// Bar Chart Component
export interface BarChartProps {
  data: ChartDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  showValues?: boolean;
  className?: string;
}

export function BarChart({
  data,
  width = 400,
  height = 200,
  color = '#3b82f6',
  showValues = true,
  className = '',
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ width, height }}>
        <span className="text-gray-500 text-sm">No data available</span>
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const maxValue = Math.max(...data.map(d => d.value));
  const barWidth = chartWidth / data.length * 0.8;
  const barSpacing = chartWidth / data.length * 0.2;

  return (
    <div className={className}>
      <svg width={width} height={height}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = padding + index * (barWidth + barSpacing) + barSpacing / 2;
          const y = padding + chartHeight - barHeight;
          const barColor = item.color || color;

          return (
            <g key={index}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={barColor}
                rx="2"
              />
              
              {/* Value label */}
              {showValues && (
                <text
                  x={x + barWidth / 2}
                  y={y - 5}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                >
                  {item.value}
                </text>
              )}
              
              {/* X-axis label */}
              <text
                x={x + barWidth / 2}
                y={height - 10}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Donut Chart Component
export interface DonutChartProps {
  data: ChartDataPoint[];
  size?: number;
  innerRadius?: number;
  showLabels?: boolean;
  showLegend?: boolean;
  className?: string;
}

export function DonutChart({
  data,
  size = 200,
  innerRadius = 0.6,
  showLabels = false,
  showLegend = true,
  className = '',
}: DonutChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ width: size, height: size }}>
        <span className="text-gray-500 text-sm">No data available</span>
      </div>
    );
  }

  const radius = size / 2 - 10;
  const innerR = radius * innerRadius;
  const center = size / 2;
  
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  const defaultColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
  ];

  let currentAngle = -90; // Start from top

  const segments = data.map((item, index) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    
    currentAngle += angle;

    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startAngleRad);
    const y1 = center + radius * Math.sin(startAngleRad);
    const x2 = center + radius * Math.cos(endAngleRad);
    const y2 = center + radius * Math.sin(endAngleRad);

    const x3 = center + innerR * Math.cos(endAngleRad);
    const y3 = center + innerR * Math.sin(endAngleRad);
    const x4 = center + innerR * Math.cos(startAngleRad);
    const y4 = center + innerR * Math.sin(startAngleRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
      'Z'
    ].join(' ');

    const color = item.color || defaultColors[index % defaultColors.length];

    return {
      ...item,
      pathData,
      color,
      percentage: Math.round(percentage * 100),
      startAngle,
      endAngle,
    };
  });

  return (
    <div className={`flex items-center ${className}`}>
      <div className="relative">
        <svg width={size} height={size}>
          {segments.map((segment, index) => (
            <g key={index}>
              <path
                d={segment.pathData}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity"
              />
              
              {showLabels && segment.percentage > 5 && (
                <text
                  x={center + (radius - innerR) / 2 * Math.cos((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
                  y={center + (radius - innerR) / 2 * Math.sin((segment.startAngle + segment.endAngle) / 2 * Math.PI / 180)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="text-xs fill-white font-medium"
                >
                  {segment.percentage}%
                </text>
              )}
            </g>
          ))}
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-500">Total</div>
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="ml-6 space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-gray-700">{segment.label}</span>
              <span className="ml-auto text-gray-500">
                {segment.value} ({segment.percentage}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Area Chart Component
export interface AreaChartProps {
  data: TimeSeriesDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
  strokeWidth?: number;
  showGrid?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  width = 400,
  height = 200,
  color = '#3b82f6',
  fillOpacity = 0.2,
  strokeWidth = 2,
  showGrid = true,
  className = '',
}: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 rounded-lg ${className}`} style={{ width, height }}>
        <span className="text-gray-500 text-sm">No data available</span>
      </div>
    );
  }

  const padding = 40;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  const values = data.map(d => d.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue || 1;

  const points = data.map((point, index) => {
    const x = padding + (index / (data.length - 1)) * chartWidth;
    const y = padding + chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
    return { x, y, ...point };
  });

  const pathData = points.map((point, index) => 
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ');

  const areaData = `${pathData} L ${points[points.length - 1]?.x || 0} ${padding + chartHeight} L ${points[0]?.x || 0} ${padding + chartHeight} Z`;

  return (
    <div className={className}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        {showGrid && (
          <g className="text-gray-300" stroke="currentColor" strokeWidth="1" opacity="0.3">
            {Array.from({ length: 5 }, (_, i) => {
              const y = padding + (i / 4) * chartHeight;
              return (
                <line key={`h-${i}`} x1={padding} y1={y} x2={padding + chartWidth} y2={y} />
              );
            })}
          </g>
        )}

        {/* Area fill */}
        <path
          d={areaData}
          fill={color}
          fillOpacity={fillOpacity}
        />

        {/* Chart line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Y-axis labels */}
        <g className="text-xs fill-gray-600">
          {Array.from({ length: 5 }, (_, i) => {
            const value = maxValue - (i / 4) * valueRange;
            const y = padding + (i / 4) * chartHeight;
            return (
              <text key={i} x={padding - 10} y={y + 4} textAnchor="end">
                {value.toFixed(0)}
              </text>
            );
          })}
        </g>
      </svg>
    </div>
  );
}