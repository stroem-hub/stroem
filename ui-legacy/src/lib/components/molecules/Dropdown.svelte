<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronDownIcon, XIcon } from '../icons';

  interface DropdownItem {
    id: string;
    label: string;
    icon?: Snippet;
    href?: string;
    divider?: boolean;
    disabled?: boolean;
    onclick?: () => void;
  }

  interface DropdownProps {
    trigger: Snippet;
    items: DropdownItem[];
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
    onItemClick?: (item: DropdownItem) => void;
    class?: string;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }

  let {
    trigger,
    items,
    placement = 'bottom-start',
    onItemClick,
    class: className = '',
    open = $bindable(false),
    onOpenChange
  }: DropdownProps = $props();

  let dropdownRef = $state<HTMLDivElement>();
  let triggerRef = $state<HTMLButtonElement>();

  // Handle click outside to close dropdown
  function handleClickOutside(event: MouseEvent) {
    if (dropdownRef && !dropdownRef.contains(event.target as Node) && 
        triggerRef && !triggerRef.contains(event.target as Node)) {
      closeDropdown();
    }
  }

  // Handle escape key to close dropdown
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      closeDropdown();
      triggerRef?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const menuItems = dropdownRef?.querySelectorAll('[role="menuitem"]:not([disabled])');
      if (menuItems && menuItems.length > 0) {
        const currentIndex = Array.from(menuItems).findIndex(item => item === document.activeElement);
        let nextIndex;
        
        if (event.key === 'ArrowDown') {
          nextIndex = currentIndex < menuItems.length - 1 ? currentIndex + 1 : 0;
        } else {
          nextIndex = currentIndex > 0 ? currentIndex - 1 : menuItems.length - 1;
        }
        
        (menuItems[nextIndex] as HTMLElement).focus();
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target as HTMLElement;
      if (target.getAttribute('role') === 'menuitem') {
        event.preventDefault();
        target.click();
      }
    }
  }

  function toggleDropdown() {
    open = !open;
    onOpenChange?.(open);
  }

  function closeDropdown() {
    open = false;
    onOpenChange?.(false);
  }

  function handleItemClick(item: DropdownItem) {
    if (item.disabled) return;
    
    if (item.onclick) {
      item.onclick();
    }
    
    onItemClick?.(item);
    closeDropdown();
  }

  // Position classes based on placement
  const positionClasses = {
    'bottom-start': 'top-full left-0 mt-1',
    'bottom-end': 'top-full right-0 mt-1',
    'top-start': 'bottom-full left-0 mb-1',
    'top-end': 'bottom-full right-0 mb-1'
  };

  $effect(() => {
    if (open) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeydown);
      
      // Focus first menu item when opened
      setTimeout(() => {
        const firstMenuItem = dropdownRef?.querySelector('[role="menuitem"]:not([disabled])') as HTMLElement;
        firstMenuItem?.focus();
      }, 0);
    } else {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

<div class="relative inline-block {className}">
  <!-- Trigger Button -->
  <button
    bind:this={triggerRef}
    onclick={toggleDropdown}
    class="inline-flex items-center justify-center"
    aria-expanded={open}
    aria-haspopup="true"
    type="button"
  >
    {@render trigger()}
  </button>

  <!-- Dropdown Menu -->
  {#if open}
    <div
      bind:this={dropdownRef}
      class="absolute z-50 {positionClasses[placement]} min-w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1"
      role="menu"
      aria-orientation="vertical"
    >
      {#each items as item (item.id)}
        {#if item.divider}
          <hr class="my-1 border-gray-200 dark:border-gray-600" />
        {:else}
          {#if item.href}
            <a
              href={item.href}
              class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none {item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
              role="menuitem"
              tabindex={item.disabled ? -1 : 0}
              onclick={() => handleItemClick(item)}
              aria-disabled={item.disabled}
            >
              {#if item.icon}
                <span class="mr-3 w-4 h-4 flex-shrink-0">
                  {@render item.icon()}
                </span>
              {/if}
              {item.label}
            </a>
          {:else}
            <button
              type="button"
              class="w-full flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none {item.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
              role="menuitem"
              tabindex={item.disabled ? -1 : 0}
              onclick={() => handleItemClick(item)}
              disabled={item.disabled}
              aria-disabled={item.disabled}
            >
              {#if item.icon}
                <span class="mr-3 w-4 h-4 flex-shrink-0">
                  {@render item.icon()}
                </span>
              {/if}
              {item.label}
            </button>
          {/if}
        {/if}
      {/each}
    </div>
  {/if}
</div>