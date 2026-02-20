<script lang="ts">
	interface Tab {
		id: string;
		label: string;
		icon: string;
	}

	let { activeTab = $bindable(), tabs }: { activeTab: string; tabs: Tab[] } = $props();
</script>

<!-- Mobile: bottom tab bar -->
<nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:hidden z-50">
	<div class="flex justify-around">
		{#each tabs as tab}
			<button
				class="flex flex-col items-center py-2 px-4 text-xs font-medium transition-colors {activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}"
				onclick={() => activeTab = tab.id}
			>
				<span class="text-xl mb-0.5">{tab.icon}</span>
				{tab.label}
			</button>
		{/each}
	</div>
</nav>

<!-- Desktop: top nav -->
<nav class="hidden sm:flex justify-center gap-1 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
	{#each tabs as tab}
		<button
			class="px-5 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
			onclick={() => activeTab = tab.id}
		>
			<span class="mr-1.5">{tab.icon}</span>
			{tab.label}
		</button>
	{/each}
</nav>
