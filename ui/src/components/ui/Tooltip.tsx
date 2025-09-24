import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

export type TooltipPlacement = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  placement?: TooltipPlacement;
  delay?: number;
  disabled?: boolean;
  className?: string;
  maxWidth?: string;
}

export function Tooltip({
  children,
  content,
  placement = 'top',
  delay = 200,
  disabled = false,
  className = '',
  maxWidth = '200px',
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const triggerRef = useRef<HTMLElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showTooltip = () => {
    if (disabled || !content) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, delay);
  };

  const hideTooltip = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const updatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let x = 0;
    let y = 0;

    switch (placement) {
      case 'top':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.top - tooltipRect.height - 8;
        break;
      case 'bottom':
        x = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
        y = triggerRect.bottom + 8;
        break;
      case 'left':
        x = triggerRect.left - tooltipRect.width - 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
      case 'right':
        x = triggerRect.right + 8;
        y = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
        break;
    }

    // Adjust for viewport boundaries
    if (x < 8) {
      x = 8;
    } else if (x + tooltipRect.width > viewportWidth - 8) {
      x = viewportWidth - tooltipRect.width - 8;
    }

    if (y < 8) {
      y = 8;
    } else if (y + tooltipRect.height > viewportHeight - 8) {
      y = viewportHeight - tooltipRect.height - 8;
    }

    setPosition({ x: x + scrollX, y: y + scrollY });
  };

  useEffect(() => {
    if (isVisible) {
      updatePosition();
      
      const handleScroll = () => updatePosition();
      const handleResize = () => updatePosition();
      
      window.addEventListener('scroll', handleScroll, true);
      window.addEventListener('resize', handleResize);
      
      return () => {
        window.removeEventListener('scroll', handleScroll, true);
        window.removeEventListener('resize', handleResize);
      };
    }
    return undefined;
  }, [isVisible, placement]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const getArrowStyles = () => {
    const arrowSize = 6;
    const arrowStyles = {
      position: 'absolute' as const,
      width: 0,
      height: 0,
    };

    switch (placement) {
      case 'top':
        return {
          ...arrowStyles,
          bottom: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderTop: `${arrowSize}px solid #1f2937`,
        };
      case 'bottom':
        return {
          ...arrowStyles,
          top: -arrowSize,
          left: '50%',
          transform: 'translateX(-50%)',
          borderLeft: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid #1f2937`,
        };
      case 'left':
        return {
          ...arrowStyles,
          right: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderLeft: `${arrowSize}px solid #1f2937`,
        };
      case 'right':
        return {
          ...arrowStyles,
          left: -arrowSize,
          top: '50%',
          transform: 'translateY(-50%)',
          borderTop: `${arrowSize}px solid transparent`,
          borderBottom: `${arrowSize}px solid transparent`,
          borderRight: `${arrowSize}px solid #1f2937`,
        };
      default:
        return arrowStyles;
    }
  };

  // Wrap the child element with event handlers
  const trigger = (
    <span
      ref={triggerRef}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
      style={{ display: 'inline-block' }}
    >
      {children}
    </span>
  );

  const tooltip = isVisible && content && (
    <div
      ref={tooltipRef}
      className={`fixed z-50 px-3 py-2 text-sm text-white bg-gray-800 rounded-md shadow-lg pointer-events-none transition-opacity duration-200 ${className}`}
      style={{
        left: position.x,
        top: position.y,
        maxWidth,
      }}
      role="tooltip"
    >
      {content}
      <div style={getArrowStyles()} />
    </div>
  );

  return (
    <>
      {trigger}
      {tooltip && createPortal(tooltip, document.body)}
    </>
  );
}

// Helper component for simple text tooltips
export interface SimpleTooltipProps {
  text: string;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
}

export function SimpleTooltip({ text, children, placement = 'top', delay = 200 }: SimpleTooltipProps) {
  return (
    <Tooltip content={text} placement={placement} delay={delay}>
      {children}
    </Tooltip>
  );
}

// Helper component for rich content tooltips
export interface RichTooltipProps {
  title?: string;
  description: string;
  children: React.ReactElement;
  placement?: TooltipPlacement;
  delay?: number;
}

export function RichTooltip({ title, description, children, placement = 'top', delay = 200 }: RichTooltipProps) {
  const content = (
    <div>
      {title && <div className="font-semibold mb-1">{title}</div>}
      <div className="text-gray-200">{description}</div>
    </div>
  );

  return (
    <Tooltip content={content} placement={placement} delay={delay} maxWidth="300px">
      {children}
    </Tooltip>
  );
}