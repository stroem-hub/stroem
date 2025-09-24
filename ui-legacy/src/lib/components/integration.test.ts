import { describe, it, expect } from 'vitest';

describe('Component Integration', () => {
  it('can import PageLayout component', async () => {
    const module = await import('./templates/PageLayout.svelte');
    expect(module.default).toBeDefined();
  });

  it('can import Breadcrumb component', async () => {
    const module = await import('./molecules/Breadcrumb.svelte');
    expect(module.default).toBeDefined();
  });

  it('can import layout utilities', async () => {
    const module = await import('../utils/layout');
    expect(module.cn).toBeDefined();
    expect(module.getContainerClass).toBeDefined();
    expect(module.getFlexClass).toBeDefined();
    expect(module.getGridClass).toBeDefined();
    expect(module.responsive).toBeDefined();
  });

  it('can import new icons', async () => {
    const homeIcon = await import('./icons/HomeIcon.svelte');
    const chevronRightIcon = await import('./icons/ChevronRightIcon.svelte');
    
    expect(homeIcon.default).toBeDefined();
    expect(chevronRightIcon.default).toBeDefined();
  });

  it('components are exported from main index', async () => {
    const module = await import('./index');
    expect(module.PageLayout).toBeDefined();
    expect(module.Breadcrumb).toBeDefined();
    expect(module.HomeIcon).toBeDefined();
    expect(module.ChevronRightIcon).toBeDefined();
  });
});