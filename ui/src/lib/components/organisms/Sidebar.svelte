<script lang="ts">
  import { page } from '$app/stores';
  import { onMount } from 'svelte';
  import { 
    DashboardIcon, 
    TasksIcon, 
    ActionsIcon, 
    TriggersIcon, 
    UserIcon, 
    LogoutIcon,
    MenuIcon,
    ChevronLeftIcon,
    ChevronDownIcon,
    XIcon,
    SettingsIcon
  } from '../icons';
  import type { NavigationItem, User } from '$lib/types';
  import ThemeToggle from '../atoms/ThemeToggle.svelte';

  interface Props {
    user?: User;
    onLogout?: () => void;
    collapsed?: boolean;
    onToggle?: (collapsed: boolean) => void;
    items?: NavigationItem[];
    class?: string;
  }

  let { 
    user, 
    onLogout, 
    collapsed = false,
    onToggle,
    items,
    class: className = '' 
  }: Props = $props();

  let mobileMenuOpen = $state(false);
  let userDropdownOpen = $state(false);
  let isMobile = $state(false);

  // Default navigation items if none provided
  const defaultNavigationItems: NavigationItem[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      href: '/',
      icon: DashboardIcon
    },
    {
      id: 'tasks',
      label: 'Tasks',
      href: '/tasks',
      icon: TasksIcon
    },
    {
      id: 'actions',
      label: 'Actions',
      href: '/actions',
      icon: ActionsIcon
    },
    {
      id: 'triggers',
      label: 'Triggers',
      href: '/triggers',
      icon: TriggersIcon
    }
  ];

  const navigationItems = items || defaultNavigationItems;

  // Check if we're on mobile
  onMount(() => {
    const checkMobile = () => {
      isMobile = window.innerWidth < 768;
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
    };
  });

  function isActive(href: string): boolean {
    if (href === '/') {
      return $page.url.pathname === '/';
    }
    return $page.url.pathname.startsWith(href);
  }

  function handleToggle() {
    if (isMobile) {
      mobileMenuOpen = !mobileMenuOpen;
    } else {
      const newCollapsed = !collapsed;
      if (onToggle) {
        onToggle(newCollapsed);
      }
    }
  }

  function closeMobileMenu() {
    mobileMenuOpen = false;
  }

  function toggleUserDropdown() {
    userDropdownOpen = !userDropdownOpen;
  }

  // Close dropdowns when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Element;
    if (!target.closest('[data-dropdown="user"]')) {
      userDropdownOpen = false;
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  });
</script>

<!-- Mobile Menu Button -->
{#if isMobile}
  <button
    onclick={handleToggle}
    class="fixed top-4 left-4 z-50 p-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 md:hidden"
    aria-label="Toggle navigation menu"
  >
    {#if mobileMenuOpen}
      <XIcon class="w-5 h-5 text-gray-600 dark:text-gray-300" />
    {:else}
      <MenuIcon class="w-5 h-5 text-gray-600 dark:text-gray-300" />
    {/if}
  </button>
{/if}

<!-- Mobile Overlay -->
{#if isMobile && mobileMenuOpen}
  <div 
    class="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
    onclick={closeMobileMenu}
    role="button"
    tabindex="0"
    aria-label="Close navigation menu"
  ></div>
{/if}

<!-- Sidebar -->
<aside 
  class="fixed top-0 left-0 z-40 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out {className}
    {isMobile 
      ? mobileMenuOpen 
        ? 'translate-x-0 w-64' 
        : '-translate-x-full w-64'
      : collapsed 
        ? 'w-16' 
        : 'w-64'
    }"
  role="navigation"
  aria-label="Main navigation"
>
  <!-- Brand -->
  <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
    <a href="/" class="flex items-center space-x-3 min-w-0">
      <img 
        src="https://cdn-icons-png.freepik.com/128/12707/12707916.png" 
        alt="Strøm" 
        class="w-8 h-8 flex-shrink-0"
      />
      {#if !collapsed || isMobile}
        <span class="text-xl font-semibold text-gray-900 dark:text-white truncate">
          Strøm
        </span>
      {/if}
    </a>
    
    <!-- Desktop Collapse Button -->
    {#if !isMobile}
      <button
        onclick={handleToggle}
        class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <ChevronLeftIcon 
          class="w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform duration-200 {collapsed ? 'rotate-180' : ''}" 
        />
      </button>
    {/if}
  </div>

  <!-- Navigation -->
  <nav class="flex-1 overflow-y-auto p-4">
    <ul class="space-y-2">
      {#each navigationItems as item}
        <li>
          {#if item.children && item.children.length > 0}
            <!-- Navigation item with children (future enhancement) -->
            <div class="space-y-1">
              <button
                class="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors duration-200"
              >
                <div class="flex items-center space-x-3">
                  {#if item.icon}
                    {@const IconComponent = item.icon}
                    <IconComponent class="w-5 h-5 flex-shrink-0" />
                  {/if}
                  {#if !collapsed || isMobile}
                    <span class="truncate">{item.label}</span>
                  {/if}
                </div>
                {#if !collapsed || isMobile}
                  <ChevronDownIcon class="w-4 h-4" />
                {/if}
              </button>
            </div>
          {:else}
            <!-- Regular navigation item -->
            <a
              href={item.href}
              onclick={isMobile ? closeMobileMenu : undefined}
              class="flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 group relative
                {isActive(item.href || '') 
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' 
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'}"
              aria-current={isActive(item.href || '') ? 'page' : undefined}
            >
              {#if item.icon}
                {@const IconComponent = item.icon}
                <IconComponent class="w-5 h-5 flex-shrink-0" />
              {/if}
              
              {#if !collapsed || isMobile}
                <span class="ml-3 truncate">{item.label}</span>
                {#if item.badge}
                  <span class="ml-auto bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded-full dark:bg-blue-900 dark:text-blue-300">
                    {item.badge}
                  </span>
                {/if}
              {:else if item.badge}
                <!-- Collapsed badge indicator -->
                <span class="absolute -top-1 -right-1 w-2 h-2 bg-blue-500 rounded-full"></span>
              {/if}
              
              <!-- Tooltip for collapsed state -->
              {#if collapsed && !isMobile}
                <div class="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                  {item.label}
                  {#if item.badge}
                    <span class="ml-1 bg-blue-600 px-1 rounded">
                      {item.badge}
                    </span>
                  {/if}
                </div>
              {/if}
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  </nav>

  <!-- User Profile -->
  {#if user}
    <div class="border-t border-gray-200 dark:border-gray-700 p-4">
      <div class="relative" data-dropdown="user">
        <button
          onclick={toggleUserDropdown}
          class="w-full flex items-center space-x-3 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200 group"
          aria-expanded={userDropdownOpen}
          aria-haspopup="true"
        >
          <div class="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
            <UserIcon class="w-4 h-4 text-white" />
          </div>
          
          {#if !collapsed || isMobile}
            <div class="flex-1 min-w-0 text-left">
              <p class="text-sm font-medium text-gray-900 dark:text-white truncate">
                {user.name || 'User'}
              </p>
              <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
                {user.email}
              </p>
            </div>
            <ChevronDownIcon 
              class="w-4 h-4 text-gray-400 transition-transform duration-200 {userDropdownOpen ? 'rotate-180' : ''}" 
            />
          {:else}
            <!-- Tooltip for collapsed state -->
            <div class="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
              {user.name || 'User'}
              <br />
              {user.email}
            </div>
          {/if}
        </button>

        <!-- User Dropdown Menu -->
        {#if userDropdownOpen && (!collapsed || isMobile)}
          <div class="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1">
            <a
              href="/profile"
              class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onclick={isMobile ? closeMobileMenu : undefined}
            >
              <UserIcon class="w-4 h-4 mr-3" />
              Profile
            </a>
            <a
              href="/settings"
              class="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              onclick={isMobile ? closeMobileMenu : undefined}
            >
              <SettingsIcon class="w-4 h-4 mr-3" />
              Settings
            </a>
            <div class="flex items-center justify-between px-4 py-2">
              <span class="text-sm text-gray-700 dark:text-gray-300">Theme</span>
              <ThemeToggle size="sm" />
            </div>
            <hr class="my-1 border-gray-200 dark:border-gray-600" />
            {#if onLogout}
              <button
                onclick={() => {
                  onLogout?.();
                  if (isMobile) closeMobileMenu();
                }}
                class="w-full flex items-center px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <LogoutIcon class="w-4 h-4 mr-3" />
                Logout
              </button>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</aside>