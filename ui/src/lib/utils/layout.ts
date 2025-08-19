/**
 * Layout utility functions for consistent spacing and alignment
 */

// Spacing utilities
export const spacing = {
  none: '',
  xs: 'space-y-1',
  sm: 'space-y-2',
  md: 'space-y-4',
  lg: 'space-y-6',
  xl: 'space-y-8',
  '2xl': 'space-y-12',
  '3xl': 'space-y-16'
} as const;

export const spacingX = {
  none: '',
  xs: 'space-x-1',
  sm: 'space-x-2',
  md: 'space-x-4',
  lg: 'space-x-6',
  xl: 'space-x-8',
  '2xl': 'space-x-12',
  '3xl': 'space-x-16'
} as const;

// Padding utilities
export const padding = {
  none: '',
  xs: 'p-1',
  sm: 'p-2',
  md: 'p-4',
  lg: 'p-6',
  xl: 'p-8',
  '2xl': 'p-12'
} as const;

export const paddingX = {
  none: '',
  xs: 'px-1',
  sm: 'px-2',
  md: 'px-4',
  lg: 'px-6',
  xl: 'px-8',
  '2xl': 'px-12'
} as const;

export const paddingY = {
  none: '',
  xs: 'py-1',
  sm: 'py-2',
  md: 'py-4',
  lg: 'py-6',
  xl: 'py-8',
  '2xl': 'py-12'
} as const;

// Margin utilities
export const margin = {
  none: '',
  xs: 'm-1',
  sm: 'm-2',
  md: 'm-4',
  lg: 'm-6',
  xl: 'm-8',
  '2xl': 'm-12'
} as const;

export const marginX = {
  none: '',
  xs: 'mx-1',
  sm: 'mx-2',
  md: 'mx-4',
  lg: 'mx-6',
  xl: 'mx-8',
  '2xl': 'mx-12'
} as const;

export const marginY = {
  none: '',
  xs: 'my-1',
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
  xl: 'my-8',
  '2xl': 'my-12'
} as const;

// Container utilities
export const container = {
  none: '',
  sm: 'max-w-sm mx-auto',
  md: 'max-w-md mx-auto',
  lg: 'max-w-lg mx-auto',
  xl: 'max-w-xl mx-auto',
  '2xl': 'max-w-2xl mx-auto',
  '3xl': 'max-w-3xl mx-auto',
  '4xl': 'max-w-4xl mx-auto',
  '5xl': 'max-w-5xl mx-auto',
  '6xl': 'max-w-6xl mx-auto',
  '7xl': 'max-w-7xl mx-auto',
  full: 'max-w-full mx-auto'
} as const;

// Flexbox utilities
export const flex = {
  row: 'flex flex-row',
  col: 'flex flex-col',
  rowReverse: 'flex flex-row-reverse',
  colReverse: 'flex flex-col-reverse',
  wrap: 'flex-wrap',
  nowrap: 'flex-nowrap',
  wrapReverse: 'flex-wrap-reverse'
} as const;

export const justify = {
  start: 'justify-start',
  end: 'justify-end',
  center: 'justify-center',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly'
} as const;

export const align = {
  start: 'items-start',
  end: 'items-end',
  center: 'items-center',
  baseline: 'items-baseline',
  stretch: 'items-stretch'
} as const;

// Grid utilities
export const grid = {
  cols1: 'grid grid-cols-1',
  cols2: 'grid grid-cols-2',
  cols3: 'grid grid-cols-3',
  cols4: 'grid grid-cols-4',
  cols5: 'grid grid-cols-5',
  cols6: 'grid grid-cols-6',
  cols12: 'grid grid-cols-12'
} as const;

export const gap = {
  none: '',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-4',
  lg: 'gap-6',
  xl: 'gap-8',
  '2xl': 'gap-12'
} as const;

// Responsive breakpoint utilities
export const breakpoints = {
  sm: 'sm:',
  md: 'md:',
  lg: 'lg:',
  xl: 'xl:',
  '2xl': '2xl:'
} as const;

// Helper function to combine classes
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Helper function to create responsive classes
export function responsive(
  base: string,
  sm?: string,
  md?: string,
  lg?: string,
  xl?: string,
  xl2?: string
): string {
  const classes = [base];
  
  if (sm) classes.push(`sm:${sm}`);
  if (md) classes.push(`md:${md}`);
  if (lg) classes.push(`lg:${lg}`);
  if (xl) classes.push(`xl:${xl}`);
  if (xl2) classes.push(`2xl:${xl2}`);
  
  return classes.join(' ');
}

// Layout component helper functions
export function getContainerClass(
  maxWidth: keyof typeof container = 'full',
  padding: keyof typeof paddingX = 'lg'
): string {
  return cn(container[maxWidth], paddingX[padding]);
}

export function getFlexClass(
  direction: 'row' | 'col' = 'row',
  justifyContent: keyof typeof justify = 'start',
  alignItems: keyof typeof align = 'start',
  gapSize: keyof typeof gap = 'md'
): string {
  const directionClass = direction === 'row' ? flex.row : flex.col;
  return cn(directionClass, justify[justifyContent], align[alignItems], gap[gapSize]);
}

export function getGridClass(
  cols: keyof typeof grid = 'cols1',
  gapSize: keyof typeof gap = 'md'
): string {
  return cn(grid[cols], gap[gapSize]);
}

// Type definitions
export type SpacingSize = keyof typeof spacing;
export type PaddingSize = keyof typeof padding;
export type MarginSize = keyof typeof margin;
export type ContainerSize = keyof typeof container;
export type FlexDirection = 'row' | 'col' | 'rowReverse' | 'colReverse';
export type JustifyContent = keyof typeof justify;
export type AlignItems = keyof typeof align;
export type GridCols = keyof typeof grid;
export type GapSize = keyof typeof gap;