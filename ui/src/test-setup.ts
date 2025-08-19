import { expect, vi } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

// Mock SvelteKit modules
vi.mock('$app/stores', () => {
  const { writable } = require('svelte/store');
  return {
    page: writable({
      url: {
        pathname: '/'
      }
    })
  };
});

vi.mock('$app/navigation', () => ({
  goto: vi.fn()
}));

vi.mock('$app/state', () => ({
  page: {
    url: {
      pathname: '/'
    }
  }
}));