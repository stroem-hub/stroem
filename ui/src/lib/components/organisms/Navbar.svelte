<script lang="ts">
  import type { Snippet } from 'svelte';
  import { MenuIcon, XIcon, UserIcon } from '../icons';
  import Dropdown from '../molecules/Dropdown.svelte';

  interface NavItem {
    id: string;
    label: string;
    href: string;
    active?: boolean;
  }

  interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  }

  interface DropdownItem {
    id: string;
    label: string;
    icon?: Snippet;
    href?: string;
    divider?: boolean;
    disabled?: boolean;
    onclick?: () => void;
  }

  interface NavbarProps {
    brand?: Snippet;
    items?: NavItem[];
    user?: User;
    userDropdownItems?: DropdownItem[];
    onMenuToggle?: () => void;
    class?: string;
  }

  let {
    brand,
    items = [],
    user,
    userDropdownItems = [],
    onMenuToggle,
    class: className = ''
  }: NavbarProps = $props();

  let mobileMenuOpen = $state(false);
  let userDropdownOpen = $state(false);

  function toggleMobileMenu() {
    mobileMenuOpen = !mobileMenuOpen;
    onMenuToggle?.();
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  // Close mobile menu when clicking on nav items
  function handleNavItemClick() {
    closeMobileMenu();
  }

  // Handle user dropdown item clicks
  function handleUserDropdownItemClick(item: DropdownItem) {
    if (item.onclick) {
      item.onclick();
    }
    closeMobileMenu();
  }
</script>

<nav class="bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700 {className}">
  <div class="max-w-screen-xl flex flex-wrap items-center justify-between mx-auto p-4">
    <!-- Brand -->
    {#if brand}
      <div class="flex items-center space-x-3 rtl:space-x-reverse">
        {@render brand()}
      </div>
    {/if}

    <!-- User Avatar and Mobile Menu Button -->
    <div class="flex items-center md:order-2 space-x-3 md:space-x-0 rtl:space-x-reverse">
      <!-- User Dropdown -->
      {#if user}
        <Dropdown
          bind:open={userDropdownOpen}
          items={userDropdownItems}
          placement="bottom-end"
          onItemClick={handleUserDropdownItemClick}
        >
          {#snippet trigger()}
            <button
              type="button"
              class="flex text-sm bg-gray-800 rounded-full md:me-0 focus:ring-4 focus:ring-gray-300 dark:focus:ring-gray-600"
              aria-expanded={userDropdownOpen}
              aria-haspopup="true"
            >
              <span class="sr-only">Open user menu</span>
              {#if user.avatar}
                <img
                  class="w-8 h-8 rounded-full"
                  src={user.avatar}
                  alt="User avatar"
                />
              {:else}
                <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                  <UserIcon class="w-4 h-4 text-white" />
                </div>
              {/if}
            </button>
          {/snippet}
        </Dropdown>
      {/if}

      <!-- Mobile menu button -->
      <button
        onclick={toggleMobileMenu}
        type="button"
        class="inline-flex items-center p-2 w-10 h-10 justify-center text-sm text-gray-500 rounded-lg md:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
        aria-controls="navbar-user"
        aria-expanded={mobileMenuOpen}
      >
        <span class="sr-only">Open main menu</span>
        {#if mobileMenuOpen}
          <XIcon class="w-5 h-5" />
        {:else}
          <MenuIcon class="w-5 h-5" />
        {/if}
      </button>
    </div>

    <!-- Navigation Items -->
    {#if items.length > 0}
      <div
        class="items-center justify-between w-full md:flex md:w-auto md:order-1 {mobileMenuOpen ? '' : 'hidden'}"
        id="navbar-user"
      >
        <ul class="flex flex-col font-medium p-4 md:p-0 mt-4 border border-gray-100 rounded-lg bg-gray-50 md:space-x-8 rtl:space-x-reverse md:flex-row md:mt-0 md:border-0 md:bg-white dark:bg-gray-800 md:dark:bg-gray-800 dark:border-gray-700">
          {#each items as item (item.id)}
            <li>
              <a
                href={item.href}
                onclick={handleNavItemClick}
                class="block py-2 px-3 rounded md:bg-transparent md:p-0 {item.active 
                  ? 'text-white bg-blue-700 md:text-blue-700 md:bg-transparent md:dark:text-blue-500' 
                  : 'text-gray-900 hover:bg-gray-100 md:hover:bg-transparent md:hover:text-blue-700 dark:text-white md:dark:hover:text-blue-500 dark:hover:bg-gray-700 dark:hover:text-white md:dark:hover:bg-transparent dark:border-gray-700'}"
                aria-current={item.active ? 'page' : undefined}
              >
                {item.label}
              </a>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>
</nav>