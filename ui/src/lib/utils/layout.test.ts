import { describe, it, expect } from 'vitest';
import {
  cn,
  responsive,
  getContainerClass,
  getFlexClass,
  getGridClass,
  spacing,
  padding,
  container,
  flex,
  justify,
  align,
  grid,
  gap
} from './layout';

describe('Layout Utilities', () => {
  describe('cn (class names helper)', () => {
    it('combines multiple class strings', () => {
      expect(cn('class1', 'class2', 'class3')).toBe('class1 class2 class3');
    });

    it('filters out falsy values', () => {
      expect(cn('class1', null, undefined, false, '', 'class2')).toBe('class1 class2');
    });

    it('handles empty input', () => {
      expect(cn()).toBe('');
    });

    it('handles single class', () => {
      expect(cn('single-class')).toBe('single-class');
    });
  });

  describe('responsive helper', () => {
    it('creates responsive classes correctly', () => {
      const result = responsive('text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl');
      expect(result).toBe('text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl 2xl:text-4xl');
    });

    it('handles partial responsive values', () => {
      const result = responsive('text-base', undefined, 'text-xl');
      expect(result).toBe('text-base md:text-xl');
    });

    it('handles only base value', () => {
      const result = responsive('text-base');
      expect(result).toBe('text-base');
    });
  });

  describe('getContainerClass', () => {
    it('returns correct container class with defaults', () => {
      const result = getContainerClass();
      expect(result).toBe('max-w-full mx-auto px-6');
    });

    it('returns correct container class with custom values', () => {
      const result = getContainerClass('4xl', 'xl');
      expect(result).toBe('max-w-4xl mx-auto px-8');
    });

    it('handles none values', () => {
      const result = getContainerClass('none', 'none');
      expect(result).toBe('');
    });
  });

  describe('getFlexClass', () => {
    it('returns correct flex class with defaults', () => {
      const result = getFlexClass();
      expect(result).toBe('flex flex-row justify-start items-start gap-4');
    });

    it('returns correct flex class with custom values', () => {
      const result = getFlexClass('col', 'center', 'center', 'lg');
      expect(result).toBe('flex flex-col justify-center items-center gap-6');
    });
  });

  describe('getGridClass', () => {
    it('returns correct grid class with defaults', () => {
      const result = getGridClass();
      expect(result).toBe('grid grid-cols-1 gap-4');
    });

    it('returns correct grid class with custom values', () => {
      const result = getGridClass('cols3', 'xl');
      expect(result).toBe('grid grid-cols-3 gap-8');
    });
  });

  describe('spacing constants', () => {
    it('has correct spacing values', () => {
      expect(spacing.none).toBe('');
      expect(spacing.xs).toBe('space-y-1');
      expect(spacing.sm).toBe('space-y-2');
      expect(spacing.md).toBe('space-y-4');
      expect(spacing.lg).toBe('space-y-6');
      expect(spacing.xl).toBe('space-y-8');
    });
  });

  describe('padding constants', () => {
    it('has correct padding values', () => {
      expect(padding.none).toBe('');
      expect(padding.xs).toBe('p-1');
      expect(padding.sm).toBe('p-2');
      expect(padding.md).toBe('p-4');
      expect(padding.lg).toBe('p-6');
      expect(padding.xl).toBe('p-8');
    });
  });

  describe('container constants', () => {
    it('has correct container values', () => {
      expect(container.none).toBe('');
      expect(container.sm).toBe('max-w-sm mx-auto');
      expect(container.md).toBe('max-w-md mx-auto');
      expect(container.lg).toBe('max-w-lg mx-auto');
      expect(container.full).toBe('max-w-full mx-auto');
    });
  });

  describe('flex constants', () => {
    it('has correct flex values', () => {
      expect(flex.row).toBe('flex flex-row');
      expect(flex.col).toBe('flex flex-col');
      expect(flex.rowReverse).toBe('flex flex-row-reverse');
      expect(flex.colReverse).toBe('flex flex-col-reverse');
    });
  });

  describe('justify constants', () => {
    it('has correct justify values', () => {
      expect(justify.start).toBe('justify-start');
      expect(justify.end).toBe('justify-end');
      expect(justify.center).toBe('justify-center');
      expect(justify.between).toBe('justify-between');
      expect(justify.around).toBe('justify-around');
      expect(justify.evenly).toBe('justify-evenly');
    });
  });

  describe('align constants', () => {
    it('has correct align values', () => {
      expect(align.start).toBe('items-start');
      expect(align.end).toBe('items-end');
      expect(align.center).toBe('items-center');
      expect(align.baseline).toBe('items-baseline');
      expect(align.stretch).toBe('items-stretch');
    });
  });

  describe('grid constants', () => {
    it('has correct grid values', () => {
      expect(grid.cols1).toBe('grid grid-cols-1');
      expect(grid.cols2).toBe('grid grid-cols-2');
      expect(grid.cols3).toBe('grid grid-cols-3');
      expect(grid.cols4).toBe('grid grid-cols-4');
      expect(grid.cols12).toBe('grid grid-cols-12');
    });
  });

  describe('gap constants', () => {
    it('has correct gap values', () => {
      expect(gap.none).toBe('');
      expect(gap.xs).toBe('gap-1');
      expect(gap.sm).toBe('gap-2');
      expect(gap.md).toBe('gap-4');
      expect(gap.lg).toBe('gap-6');
      expect(gap.xl).toBe('gap-8');
    });
  });
});