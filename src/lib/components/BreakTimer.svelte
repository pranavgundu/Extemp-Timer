<script lang="ts">
	import { tournament } from '$lib/stores/tournament.svelte';
	import { getNow } from '$lib/stores/timer.svelte';
	import { alerts } from '$lib/audio';
	import { settings } from '$lib/stores/settings.svelte';

	let activeBreak = $derived(tournament.activeBreak);

	let remaining = $derived.by(() => {
		if (!activeBreak) return 0;
		const elapsed = (getNow() - activeBreak.startedAt) / 1000;
		const total = activeBreak.duration * 60;
		return Math.max(0, total - elapsed);
	});

	let minutes = $derived(Math.floor(remaining / 60).toString().padStart(2, '0'));
	let seconds = $derived(Math.floor(remaining % 60).toString().padStart(2, '0'));
	let isExpired = $derived(remaining <= 0 && activeBreak !== null);

	let alertPlayed = $state(false);

	$effect(() => {
		if (isExpired && !alertPlayed) {
			if (settings.audioEnabled) alerts.breakEnd();
			alertPlayed = true;
		}
		if (!isExpired) alertPlayed = false;
	});
</script>

{#if activeBreak}
	<div class="fixed inset-0 bg-white dark:bg-gray-950 z-40 flex flex-col items-center justify-center">
		<p class="text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
			{activeBreak.label}
		</p>
		<time class="font-mono text-8xl sm:text-9xl font-bold {isExpired ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-gray-100'}">
			{minutes}:{seconds}
		</time>
		<p class="text-gray-500 dark:text-gray-400 mt-4">
			{isExpired ? 'Break is over!' : 'Next round starts soon...'}
		</p>
		<button
			class="mt-8 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
			onclick={() => tournament.endBreak()}
		>
			{isExpired ? 'Start Next Round' : 'End Break Early'}
		</button>
	</div>
{/if}
