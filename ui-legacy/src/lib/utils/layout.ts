import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}

/**
 * Utility function to generate responsive breakpoint classes
 */
export function responsive(base: string, sm?: string, md?: string, lg?: string, xl?: string) {
	const classes = [base];
	
	if (sm) classes.push(`sm:${sm}`);
	if (md) classes.push(`md:${md}`);
	if (lg) classes.push(`lg:${lg}`);
	if (xl) classes.push(`xl:${xl}`);
	
	return classes.join(' ');
}

/**
 * Utility function to handle dark mode classes
 */
export function darkMode(light: string, dark: string) {
	return `${light} dark:${dark}`;
}

/**
 * Utility function to generate container classes
 */
export function getContainerClass(maxWidth?: string, padding?: string) {
	const classes = ['mx-auto', 'w-full'];
	
	if (maxWidth) classes.push(`max-w-${maxWidth}`);
	if (padding) classes.push(`p-${padding}`);
	
	return classes.join(' ');
}

/**
 * Utility function to generate flex classes
 */
export function getFlexClass(direction?: string, justify?: string, align?: string, wrap?: boolean) {
	const classes = ['flex'];
	
	if (direction) classes.push(`flex-${direction}`);
	if (justify) classes.push(`justify-${justify}`);
	if (align) classes.push(`items-${align}`);
	if (wrap) classes.push('flex-wrap');
	
	return classes.join(' ');
}

/**
 * Utility function to generate grid classes
 */
export function getGridClass(cols?: number, gap?: string, rows?: number) {
	const classes = ['grid'];
	
	if (cols) classes.push(`grid-cols-${cols}`);
	if (gap) classes.push(`gap-${gap}`);
	if (rows) classes.push(`grid-rows-${rows}`);
	
	return classes.join(' ');
}