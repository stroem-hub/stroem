<script lang="ts">
	interface Tab {
		id: string;
		title: string;
		content: import('svelte').Snippet;
	}

	interface Props {
		tabs: Tab[];
		activeTab?: string;
		onTabChange?: (tabId: string) => void;
		class?: string;
	}

	let { tabs, activeTab = tabs[0]?.id, onTabChange, class: className = '' }: Props = $props();

	function handleTabClick(tabId: string) {
		activeTab = tabId;
		onTabChange?.(tabId);
	}
</script>

<div class="w-full {className}">
	<!-- Tab Headers -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<nav class="-mb-px flex space-x-8" aria-label="Tabs">
			{#each tabs as tab}
				<button
					onclick={() => handleTabClick(tab.id)}
					class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
						{activeTab === tab.id
							? 'border-primary-500 text-primary-600 dark:text-primary-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
					aria-current={activeTab === tab.id ? 'page' : undefined}
				>
					{tab.title}
				</button>
			{/each}
		</nav>
	</div>

	<!-- Tab Content -->
	<div class="mt-4">
		{#each tabs as tab}
			{#if activeTab === tab.id}
				<div role="tabpanel" aria-labelledby="tab-{tab.id}">
					{@render tab.content()}
				</div>
			{/if}
		{/each}
	</div>
</div>