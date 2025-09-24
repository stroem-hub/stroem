<script lang="ts">
	interface ActivityItem {
		id: string;
		type: 'job_started' | 'job_completed' | 'job_failed' | 'task_created' | 'task_updated' | 'worker_connected' | 'worker_disconnected';
		title: string;
		description?: string;
		timestamp: Date;
		user?: string;
		metadata?: Record<string, any>;
	}

	interface ActivityFeedProps {
		items: ActivityItem[];
		loading?: boolean;
		onLoadMore?: () => void;
		hasMore?: boolean;
		maxHeight?: string;
	}

	let {
		items = [],
		loading = false,
		onLoadMore,
		hasMore = false,
		maxHeight = '400px'
	}: ActivityFeedProps = $props();

	function getActivityIcon(type: ActivityItem['type']) {
		switch (type) {
			case 'job_started':
				return {
					icon: 'M14.828 14.828a4 4 0 01-5.656 0M9 10h1.586a1 1 0 01.707.293l2.414 2.414a1 1 0 00.707.293H15M9 10V9a4 4 0 118 0v1M9 10v5a2 2 0 002 2h2a2 2 0 002-2v-5',
					color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/20'
				};
			case 'job_completed':
				return {
					icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
					color: 'text-green-500 bg-green-100 dark:bg-green-900/20'
				};
			case 'job_failed':
				return {
					icon: 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z',
					color: 'text-red-500 bg-red-100 dark:bg-red-900/20'
				};
			case 'task_created':
			case 'task_updated':
				return {
					icon: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
					color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/20'
				};
			case 'worker_connected':
				return {
					icon: 'M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0',
					color: 'text-green-500 bg-green-100 dark:bg-green-900/20'
				};
			case 'worker_disconnected':
				return {
					icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 12h.01',
					color: 'text-red-500 bg-red-100 dark:bg-red-900/20'
				};
			default:
				return {
					icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
					color: 'text-gray-500 bg-gray-100 dark:bg-gray-900/20'
				};
		}
	}

	function formatTimestamp(timestamp: Date): string {
		const now = new Date();
		const diff = now.getTime() - timestamp.getTime();
		const minutes = Math.floor(diff / 60000);
		const hours = Math.floor(diff / 3600000);
		const days = Math.floor(diff / 86400000);

		if (minutes < 1) return 'Just now';
		if (minutes < 60) return `${minutes}m ago`;
		if (hours < 24) return `${hours}h ago`;
		if (days < 7) return `${days}d ago`;
		return timestamp.toLocaleDateString();
	}
</script>

<div class="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
	<div class="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
		<h3 class="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
	</div>

	<div class="overflow-hidden" style="max-height: {maxHeight};">
		{#if loading && items.length === 0}
			<div class="p-4">
				{#each Array(5) as _}
					<div class="mb-4 flex animate-pulse items-start space-x-3">
						<div class="h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
						<div class="flex-1 space-y-2">
							<div class="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700"></div>
							<div class="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700"></div>
						</div>
						<div class="h-3 w-16 rounded bg-gray-200 dark:bg-gray-700"></div>
					</div>
				{/each}
			</div>
		{:else if items.length === 0}
			<div class="flex items-center justify-center p-8">
				<div class="text-center">
					<svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
					</svg>
					<h3 class="mt-2 text-sm font-medium text-gray-900 dark:text-white">No recent activity</h3>
					<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">Activity will appear here as it happens.</p>
				</div>
			</div>
		{:else}
			<div class="divide-y divide-gray-200 dark:divide-gray-700">
				{#each items as item (item.id)}
					{@const iconData = getActivityIcon(item.type)}
					<div class="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50">
						<div class="flex items-start space-x-3">
							<div class="flex h-8 w-8 items-center justify-center rounded-full {iconData.color}">
								<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={iconData.icon} />
								</svg>
							</div>
							<div class="min-w-0 flex-1">
								<p class="text-sm font-medium text-gray-900 dark:text-white">
									{item.title}
								</p>
								{#if item.description}
									<p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
										{item.description}
									</p>
								{/if}
								{#if item.user}
									<p class="mt-1 text-xs text-gray-400 dark:text-gray-500">
										by {item.user}
									</p>
								{/if}
							</div>
							<div class="flex-shrink-0">
								<time class="text-xs text-gray-500 dark:text-gray-400">
									{formatTimestamp(item.timestamp)}
								</time>
							</div>
						</div>
					</div>
				{/each}
			</div>

			{#if hasMore && onLoadMore}
				<div class="border-t border-gray-200 p-4 dark:border-gray-700">
					<button
						type="button"
						onclick={onLoadMore}
						disabled={loading}
						class="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
					>
						{#if loading}
							<svg class="mx-auto h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
								<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
								<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
							</svg>
						{:else}
							Load more activity
						{/if}
					</button>
				</div>
			{/if}
		{/if}
	</div>
</div>