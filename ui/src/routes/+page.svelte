<script lang="ts">
  // This is a basic dashboard to test our new foundation
</script>

<div class="space-y-6">
  <!-- Page Header -->
  <div class="border-b border-gray-200 dark:border-gray-700 pb-4">
    <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">Dashboard</h1>
    <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
      Welcome to Strøm orchestration platform
    </p>
  </div>

  <!-- Metrics Grid -->
  <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Total Jobs -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
            </svg>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Total Jobs</p>
          <p class="text-2xl font-semibold text-gray-900 dark:text-white">1,234</p>
        </div>
      </div>
    </div>

    <!-- Running Jobs -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-warning-100 dark:bg-warning-900/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Running Jobs</p>
          <p class="text-2xl font-semibold text-gray-900 dark:text-white">12</p>
        </div>
      </div>
    </div>

    <!-- Success Rate -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Success Rate</p>
          <p class="text-2xl font-semibold text-gray-900 dark:text-white">94.2%</p>
        </div>
      </div>
    </div>

    <!-- Active Workers -->
    <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="w-8 h-8 bg-info-100 dark:bg-info-900/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-info-600 dark:text-info-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z"/>
            </svg>
          </div>
        </div>
        <div class="ml-4">
          <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Active Workers</p>
          <p class="text-2xl font-semibold text-gray-900 dark:text-white">3</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Recent Activity -->
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h2>
    </div>
    <div class="p-6">
      <div class="space-y-4">
        <div class="flex items-center space-x-3">
          <div class="w-2 h-2 bg-success-500 rounded-full"></div>
          <div class="flex-1">
            <p class="text-sm text-gray-900 dark:text-white">Task "data-processing" completed successfully</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">2 minutes ago</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-2 h-2 bg-warning-500 rounded-full"></div>
          <div class="flex-1">
            <p class="text-sm text-gray-900 dark:text-white">Task "backup-routine" started</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">5 minutes ago</p>
          </div>
        </div>
        <div class="flex items-center space-x-3">
          <div class="w-2 h-2 bg-success-500 rounded-full"></div>
          <div class="flex-1">
            <p class="text-sm text-gray-900 dark:text-white">Task "email-notifications" completed successfully</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">12 minutes ago</p>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- Quick Actions -->
  <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
    <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
      <h2 class="text-lg font-medium text-gray-900 dark:text-white">Quick Actions</h2>
    </div>
    <div class="p-6">
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <a 
          href="/tasks" 
          class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="w-8 h-8 bg-primary-100 dark:bg-primary-900/20 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-4 h-4 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4"/>
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">View Tasks</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Manage workflow tasks</p>
          </div>
        </a>
        
        <a 
          href="/jobs" 
          class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="w-8 h-8 bg-warning-100 dark:bg-warning-900/20 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-4 h-4 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/>
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">Monitor Jobs</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Track job execution</p>
          </div>
        </a>
        
        <a 
          href="/actions" 
          class="flex items-center p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <div class="w-8 h-8 bg-success-100 dark:bg-success-900/20 rounded-lg flex items-center justify-center mr-3">
            <svg class="w-4 h-4 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-900 dark:text-white">Browse Actions</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">Explore available actions</p>
          </div>
        </a>
      </div>
    </div>
  </div>
</div>