<script lang="ts">
	import TabBar from '$lib/components/TabBar.svelte';
	import RoundTimer from '$lib/components/RoundTimer.svelte';
	import RoundSetup from '$lib/components/RoundSetup.svelte';
	import TournamentManager from '$lib/components/TournamentManager.svelte';
	import BreakTimer from '$lib/components/BreakTimer.svelte';
	import { settings } from '$lib/stores/settings.svelte';

	let activeTab = $state('timer');

	const tabs = [
		{ id: 'timer', label: 'Timer', icon: '⏱' },
		{ id: 'setup', label: 'Setup', icon: '⚙' },
		{ id: 'tournament', label: 'Rounds', icon: '📋' },
	];
</script>

<svelte:head>
	<title>Extemp Timer</title>
</svelte:head>

<div class="min-h-dvh flex flex-col {settings.darkMode ? 'dark' : ''}">
	<div class="flex-1 flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
		<TabBar {tabs} bind:activeTab />

		<main class="flex-1 flex flex-col overflow-hidden">
			{#if activeTab === 'timer'}
				<RoundTimer />
			{:else if activeTab === 'setup'}
				<RoundSetup />
			{:else if activeTab === 'tournament'}
				<TournamentManager />
			{/if}
		</main>
	</div>

	<BreakTimer />
</div>
