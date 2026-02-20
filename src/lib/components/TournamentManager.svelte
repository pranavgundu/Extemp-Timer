<script lang="ts">
	import { tournament } from '$lib/stores/tournament.svelte';
	import { getSpeakerTimes } from '$lib/stores/timer.svelte';
	import type { RoundType } from '$lib/types';

	let showAddMenu = $state(false);
	let breakDuration = $state(15);

	function estimateEndTime(roundIndex: number): string {
		const round = tournament.rounds[roundIndex];
		if (!round || round.speakers.length === 0) return '';
		const lastSpeaker = round.speakers.length - 1;
		const times = getSpeakerTimes(round, lastSpeaker);
		const end = times.speakEndTime;
		const h = end.getHours() % 12 || 12;
		const m = end.getMinutes().toString().padStart(2, '0');
		const ampm = end.getHours() >= 12 ? 'PM' : 'AM';
		return `${h}:${m} ${ampm}`;
	}

	function suggestNextStartTime(roundIndex: number): string {
		const round = tournament.rounds[roundIndex];
		if (!round || round.speakers.length === 0) return '09:00';
		const lastSpeaker = round.speakers.length - 1;
		const times = getSpeakerTimes(round, lastSpeaker);
		const suggested = new Date(times.speakEndTime.getTime() + 15 * 60000);
		const h = suggested.getHours().toString().padStart(2, '0');
		const m = suggested.getMinutes().toString().padStart(2, '0');
		return `${h}:${m}`;
	}

	function addRound(type: RoundType) {
		tournament.addRound(type);
		const newIndex = tournament.rounds.length - 1;
		if (newIndex > 0) {
			tournament.updateRound(newIndex, { startTime: suggestNextStartTime(newIndex - 1) });
		}
		showAddMenu = false;
	}

	function startBreak() {
		tournament.startBreak(breakDuration, 'Break');
	}
</script>

<div class="p-4 sm:p-8 max-w-lg mx-auto w-full space-y-4 pb-24 sm:pb-8 overflow-auto">
	<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Tournament Rounds</h2>

	<!-- Round list -->
	<div class="space-y-2">
		{#each tournament.rounds as round, i}
			<button
				class="w-full text-left p-4 rounded-xl border transition-colors {tournament.currentRoundIndex === i ? 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-600' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600'}"
				onclick={() => tournament.setCurrentRoundIndex(i)}
			>
				<div class="flex items-center justify-between">
					<div>
						<span class="font-semibold text-gray-900 dark:text-gray-100">Round {i + 1}</span>
						<span class="ml-2 text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
							{round.type}
						</span>
					</div>
					<span class="text-xs px-2 py-0.5 rounded-full {round.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' : round.status === 'completed' ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400'}">
						{round.status}
					</span>
				</div>
				<div class="mt-1 text-sm text-gray-500 dark:text-gray-400">
					{round.startTime} &middot; {round.speakers.length} speakers &middot; ends ~{estimateEndTime(i)}
				</div>
			</button>
		{/each}
	</div>

	<!-- Actions -->
	<div class="flex gap-2">
		<div class="relative flex-1">
			<button
				class="w-full py-3 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 font-medium hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
				onclick={() => showAddMenu = !showAddMenu}
			>
				+ Add Round
			</button>
			{#if showAddMenu}
				<div class="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-10 overflow-hidden">
					{#each ['prelim', 'quarter', 'semi', 'final'] as type}
						<button
							class="w-full text-left px-4 py-3 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
							onclick={() => addRound(type as RoundType)}
						>
							{type.charAt(0).toUpperCase() + type.slice(1)}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<button
			class="flex-1 py-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
			onclick={startBreak}
		>
			Start Break
		</button>
	</div>

	<!-- Break duration -->
	<div class="flex items-center gap-3">
		<label for="break-dur" class="text-sm text-gray-500 dark:text-gray-400">Break duration:</label>
		<input
			id="break-dur"
			type="number"
			min="1"
			max="60"
			bind:value={breakDuration}
			class="w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1 text-center text-sm text-gray-900 dark:text-gray-100"
		/>
		<span class="text-sm text-gray-400 dark:text-gray-500">min</span>
	</div>

	<!-- Activate round -->
	{#if tournament.rounds.length > 0}
		<button
			class="w-full py-3 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition-colors"
			onclick={() => tournament.activateRound(tournament.currentRoundIndex)}
		>
			Activate Round {tournament.currentRoundIndex + 1}
		</button>
	{/if}

	<!-- Remove round -->
	{#if tournament.rounds.length > 1}
		<button
			class="w-full py-2 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
			onclick={() => tournament.removeRound(tournament.currentRoundIndex)}
		>
			Remove Round {tournament.currentRoundIndex + 1}
		</button>
	{/if}
</div>
