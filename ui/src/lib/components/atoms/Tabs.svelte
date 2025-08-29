<script lang="ts">
	interface Tab {
		id: string;
		title: string;
		content: import('svelte').Snippet;
		disabled?: boolean;
	}

	interface Props {
		tabs: Tab[];
		activeTab?: string;
		onTabChange?: (tabId: string) => void;
		class?: string;
	}

	let { tabs, activeTab = tabs[0]?.id, onTabChange, class: className = '' }: Props = $props();

	function handleTabClick(tabId: string) {
		const tab = tabs.find(t => t.id === tabId);
		if (tab?.disabled) return;
		
		activeTab = tabId;
		onTabChange?.(tabId);
	}

	function handleKeyDown(event: KeyboardEvent, tabId: string) {
		const currentIndex = tabs.findIndex(t => t.id === tabId);
		let nextIndex = currentIndex;

		switch (event.key) {
			case 'ArrowLeft':
				event.preventDefault();
				nextIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1;
				break;
			case 'ArrowRight':
				event.preventDefault();
				nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0;
				break;
			case 'Home':
				event.preventDefault();
				nextIndex = 0;
				break;
			case 'End':
				event.preventDefault();
				nextIndex = tabs.length - 1;
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				handleTabClick(tabId);
				return;
		}

		// Find next non-disabled tab
		while (tabs[nextIndex]?.disabled && nextIndex !== currentIndex) {
			if (event.key === 'ArrowLeft' || event.key === 'End') {
				nextIndex = nextIndex > 0 ? nextIndex - 1 : tabs.length - 1;
			} else {
				nextIndex = nextIndex < tabs.length - 1 ? nextIndex + 1 : 0;
			}
		}

		if (!tabs[nextIndex]?.disabled) {
			const nextButton = document.querySelector(`[data-tab-id="${tabs[nextIndex].id}"]`) as HTMLButtonElement;
			nextButton?.focus();
		}
	}
</script>

<div class="w-full {className}">
	<!-- Tab Headers -->
	<div class="border-b border-gray-200 dark:border-gray-700">
		<div class="-mb-px flex space-x-8" aria-label="Tabs" role="tablist">
			{#each tabs as tab, index}
				<button
					data-tab-id={tab.id}
					onclick={() => handleTabClick(tab.id)}
					onkeydown={(e) => handleKeyDown(e, tab.id)}
					class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm transition-colors duration-200
						{activeTab === tab.id
							? 'border-primary-500 text-primary-600 dark:text-primary-400'
							: 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}
						{tab.disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}"
					role="tab"
					aria-selected={activeTab === tab.id}
					aria-controls="tabpanel-{tab.id}"
					id="tab-{tab.id}"
					tabindex={activeTab === tab.id ? 0 : -1}
					disabled={tab.disabled}
				>
					{tab.title}
				</button>
			{/each}
		</div>
	</div>

	<!-- Tab Content -->
	<div class="mt-4">
		{#each tabs as tab}
			{#if activeTab === tab.id}
				<div 
					role="tabpanel" 
					aria-labelledby="tab-{tab.id}"
					id="tabpanel-{tab.id}"
					tabindex="0"
				>
					{@render tab.content()}
				</div>
			{/if}
		{/each}
	</div>
</div>