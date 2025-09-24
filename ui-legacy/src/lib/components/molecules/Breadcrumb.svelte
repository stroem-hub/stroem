<script lang="ts">
  import { ChevronRightIcon, HomeIcon } from '../icons';
  import type { Breadcrumb } from '$lib/types';

  interface Props {
    items: Breadcrumb[];
    showHome?: boolean;
    class?: string;
  }

  let { 
    items = [], 
    showHome = true,
    class: className = '' 
  }: Props = $props();

  // Add home breadcrumb if showHome is true and items don't start with home
  const breadcrumbs = $derived(
    showHome && (items.length === 0 || items[0].href !== '/') 
      ? [{ label: 'Home', href: '/' }, ...items]
      : items
  );
</script>

<nav 
  class="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 {className}"
  aria-label="Breadcrumb"
>
  <ol class="flex items-center space-x-1">
    {#each breadcrumbs as breadcrumb, index}
      <li class="flex items-center">
        {#if index > 0}
          <ChevronRightIcon class="w-4 h-4 mx-1 text-gray-400 dark:text-gray-500" />
        {/if}
        
        {#if breadcrumb.href && index < breadcrumbs.length - 1}
          <a
            href={breadcrumb.href}
            class="flex items-center hover:text-gray-700 dark:hover:text-gray-300 transition-colors duration-200"
          >
            {#if index === 0 && showHome}
              <HomeIcon class="w-4 h-4 mr-1" />
            {/if}
            <span class="truncate max-w-32 sm:max-w-48">{breadcrumb.label}</span>
          </a>
        {:else}
          <span 
            class="flex items-center text-gray-900 dark:text-gray-100 font-medium"
            aria-current="page"
          >
            {#if index === 0 && showHome}
              <HomeIcon class="w-4 h-4 mr-1" />
            {/if}
            <span class="truncate max-w-32 sm:max-w-48">{breadcrumb.label}</span>
          </span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>