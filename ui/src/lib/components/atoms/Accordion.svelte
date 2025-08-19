<script lang="ts">
	interface AccordionItem {
		id: string;
		header: import('svelte').Snippet;
		content: import('svelte').Snippet;
		open?: boolean;
	}

	interface Props {
		items: AccordionItem[];
		allowMultiple?: boolean;
		class?: string;
	}

	let { items, allowMultiple = false, class: className = '' }: Props = $props();
	
	let openItems = $state<Set<string>>(new Set(items.filter(item => item.open).map(item => item.id)));

	function toggleItem(id: string) {
		if (openItems.has(id)) {
			openItems.delete(id);
		} else {
			if (!allowMultiple) {
				openItems.clear();
			}
			openItems.add(id);
		}
		openItems = new Set(openItems); // Trigger reactivity
	}
</script>

<div class="divide-y divide-gray-200 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg {className}">
	{#each items as item}
		<div class="accordion-item">
			<button
				class="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200"
				onclick={() => toggleItem(item.id)}
				aria-expanded={openItems.has(item.id)}
			>
				<div class="flex-1">
					{@render item.header()}
				</div>
				<svg 
					class="w-5 h-5 text-gray-500 transition-transform duration-200 {openItems.has(item.id) ? 'rotate-180' : ''}"
					fill="none" 
					stroke="currentColor" 
					viewBox="0 0 24 24"
				>
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
				</svg>
			</button>
			
			{#if openItems.has(item.id)}
				<div class="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
					<div class="pt-4">
						{@render item.content()}
					</div>
				</div>
			{/if}
		</div>
	{/each}
</div>