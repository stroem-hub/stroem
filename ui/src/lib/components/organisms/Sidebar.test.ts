import { describe, it, expect } from 'vitest';
import Sidebar from './Sidebar.svelte';

describe('Sidebar', () => {
  it('should be importable', () => {
    expect(Sidebar).toBeDefined();
  });

  it('should be a Svelte component', () => {
    expect(typeof Sidebar).toBe('function');
  });
});