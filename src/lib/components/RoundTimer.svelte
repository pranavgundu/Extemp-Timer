<script lang="ts">
	import Clock from './Clock.svelte';
	import SpeakerRow from './SpeakerRow.svelte';
	import { tournament } from '$lib/stores/tournament.svelte';
	import { getNow, getSpeakerStatus } from '$lib/stores/timer.svelte';

	let round = $derived(tournament.currentRound);
	let roundIndex = $derived(tournament.currentRoundIndex);

	let progress = $derived.by(() => {
		if (!round) return 0;
		const total = round.speakers.length;
		let done = 0;
		for (let i = 0; i < total; i++) {
			const s = getSpeakerStatus(round, i, getNow());
			if (s === 'done') done++;
		}
		return Math.round((done / total) * 100);
	});
</script>

<div class="flex flex-col h-full">
	{#if round}
		<!-- Progress bar -->
		<div class="h-1.5 bg-gray-200 dark:bg-gray-700 w-full">
			<div
				class="h-full bg-blue-500 transition-all duration-1000 ease-linear"
				style="width: {progress}%"
			></div>
		</div>

		<Clock />

		<!-- Round info -->
		<div class="text-center text-sm text-gray-500 dark:text-gray-400 pb-3">
			Round {roundIndex + 1} &middot; {round.type.charAt(0).toUpperCase() + round.type.slice(1)} &middot; {round.speakers.length} speakers
		</div>

		<!-- Speaker table -->
		<div class="flex-1 overflow-auto px-2 sm:px-6 pb-20 sm:pb-4">
			<table class="w-full">
				<thead>
					<tr class="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
						<th class="px-3 py-2 text-center w-10">#</th>
						<th class="px-3 py-2 text-left">Name</th>
						<th class="px-3 py-2 text-center hidden sm:table-cell">Call</th>
						<th class="px-3 py-2 text-center hidden sm:table-cell">Draw</th>
						<th class="px-3 py-2 text-center hidden sm:table-cell">Release</th>
						<th class="px-3 py-2 text-center hidden sm:table-cell">Speak</th>
						<th class="px-3 py-2 text-center">Status</th>
					</tr>
				</thead>
				<tbody>
					{#each round.speakers as _, i}
						<SpeakerRow {round} speakerIndex={i} {roundIndex} />
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
			No rounds configured. Go to Setup to add one.
		</div>
	{/if}
</div>
