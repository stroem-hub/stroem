import React from 'react';

export type BadgeVariant = 
  | 'default' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'info' 
  | 'secondary'
  | 'running'
  | 'completed'
  | 'failed'
  | 'queued';

export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
  icon?: React.ReactNode;
  pulse?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-gray-100 text-gray-800 border-gray-200',
  secondary: 'bg-gray-100 text-gray-600 border-gray-200',
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  error: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  // Job status specific variants
  running: 'bg-blue-100 text-blue-800 border-blue-200',
  completed: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  queued: 'bg-yellow-100 text-yellow-800 border-yellow-200',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

const pulseStyles: Record<BadgeVariant, string> = {
  default: '',
  secondary: '',
  success: '',
  warning: '',
  error: '',
  info: '',
  running: 'animate-pulse',
  completed: '',
  failed: '',
  queued: '',
};

export function Badge({
  children,
  variant = 'default',
  size = 'md',
  className = '',
  icon,
  pulse = false,
}: BadgeProps) {
  const baseStyles = 'inline-flex items-center font-medium rounded-full border';
  const variantStyle = variantStyles[variant];
  const sizeStyle = sizeStyles[size];
  const pulseStyle = pulse || variant === 'running' ? pulseStyles[variant] : '';

  return (
    <span
      className={`${baseStyles} ${variantStyle} ${sizeStyle} ${pulseStyle} ${className}`}
    >
      {icon && (
        <span className={`${size === 'sm' ? 'mr-1' : 'mr-1.5'} flex-shrink-0`}>
          {icon}
        </span>
      )}
      {children}
    </span>
  );
}

// Predefined status badges for common use cases
export function StatusBadge({ 
  status, 
  size = 'md', 
  className = '' 
}: { 
  status: string; 
  size?: BadgeSize; 
  className?: string; 
}) {
  const getVariantForStatus = (status: string): BadgeVariant => {
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'running':
      case 'in_progress':
      case 'active':
        return 'running';
      case 'completed':
      case 'success':
      case 'successful':
      case 'done':
        return 'completed';
      case 'failed':
      case 'error':
      case 'failure':
        return 'failed';
      case 'queued':
      case 'pending':
      case 'waiting':
        return 'queued';
      case 'cancelled':
      case 'canceled':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getIconForStatus = (status: string) => {
    const normalizedStatus = status.toLowerCase();
    
    switch (normalizedStatus) {
      case 'running':
      case 'in_progress':
      case 'active':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
        );
      case 'completed':
      case 'success':
      case 'successful':
      case 'done':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'failed':
      case 'error':
      case 'failure':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      case 'queued':
      case 'pending':
      case 'waiting':
        return (
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
          </svg>
        );
      default:
        return null;
    }
  };

  const variant = getVariantForStatus(status);
  const icon = getIconForStatus(status);

  return (
    <Badge
      variant={variant}
      size={size}
      className={className}
      icon={icon}
    >
      {status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()}
    </Badge>
  );
}

// Priority badge for tasks
export function PriorityBadge({ 
  priority, 
  size = 'sm', 
  className = '' 
}: { 
  priority: 'low' | 'medium' | 'high' | 'critical'; 
  size?: BadgeSize; 
  className?: string; 
}) {
  const getVariantForPriority = (priority: string): BadgeVariant => {
    switch (priority.toLowerCase()) {
      case 'critical':
        return 'error';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return (
    <Badge
      variant={getVariantForPriority(priority)}
      size={size}
      className={className}
    >
      {priority.charAt(0).toUpperCase() + priority.slice(1)}
    </Badge>
  );
}