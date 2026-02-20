<script lang="ts">
	import { tournament } from '$lib/stores/tournament.svelte';
	import { settings } from '$lib/stores/settings.svelte';
	import type { RoundType } from '$lib/types';

	let roundIndex = $derived(tournament.currentRoundIndex);
	let round = $derived(tournament.currentRound);

	function updateType(type: RoundType) {
		if (!round) return;
		const speakerCounts: Record<RoundType, number> = { prelim: 7, quarter: 8, semi: 4, final: 4 };
		tournament.updateRound(roundIndex, { type });
		tournament.setSpeakerCount(roundIndex, speakerCounts[type]);
	}

	function updateStartTime(value: string) {
		tournament.updateRound(roundIndex, { startTime: value });
	}

	function updateInterval(field: 'drawInterval' | 'releaseInterval' | 'callInterval', value: number) {
		tournament.updateRound(roundIndex, { [field]: value });
	}

	function updateSpeakerCount(count: number) {
		if (count < 1 || count > 20) return;
		tournament.setSpeakerCount(roundIndex, count);
	}

	const roundTypes: { value: RoundType; label: string }[] = [
		{ value: 'prelim', label: 'Prelim' },
		{ value: 'quarter', label: 'Quarters' },
		{ value: 'semi', label: 'Semis' },
		{ value: 'final', label: 'Finals' },
	];
</script>

<div class="p-4 sm:p-8 max-w-lg mx-auto w-full space-y-6 pb-24 sm:pb-8 overflow-auto">
	{#if round}
		<h2 class="text-lg font-bold text-gray-900 dark:text-gray-100">Round Setup</h2>

		<!-- Round Type -->
		<div>
			<span class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Round Type</span>
			<div class="grid grid-cols-4 gap-2">
				{#each roundTypes as rt}
					<button
						class="py-2 px-3 rounded-lg text-sm font-medium transition-colors {round.type === rt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}"
						onclick={() => updateType(rt.value)}
					>
						{rt.label}
					</button>
				{/each}
			</div>
		</div>

		<!-- Start Time -->
		<div>
			<label for="start-time" class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Start Time</label>
			<input
				id="start-time"
				type="time"
				value={round.startTime}
				onchange={(e) => updateStartTime(e.currentTarget.value)}
				class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-lg text-gray-900 dark:text-gray-100"
			/>
		</div>

		<!-- Speakers -->
		<div>
			<span class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Speakers</span>
			<div class="flex items-center gap-3">
				<button
					class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
					onclick={() => updateSpeakerCount(round!.speakers.length - 1)}
				>&minus;</button>
				<span class="text-2xl font-bold text-gray-900 dark:text-gray-100 w-12 text-center">{round.speakers.length}</span>
				<button
					class="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 text-lg font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
					onclick={() => updateSpeakerCount(round!.speakers.length + 1)}
				>+</button>
			</div>
		</div>

		<!-- Intervals -->
		<div class="space-y-4">
			<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Intervals (minutes)</h3>

			<div class="grid grid-cols-3 gap-4">
				<div>
					<label for="draw-int" class="block text-xs text-gray-500 dark:text-gray-500 mb-1">Draw</label>
					<input
						id="draw-int"
						type="number"
						min="1"
						max="30"
						value={round.drawInterval}
						onchange={(e) => updateInterval('drawInterval', parseInt(e.currentTarget.value) || 7)}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-center text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="release-int" class="block text-xs text-gray-500 dark:text-gray-500 mb-1">Release</label>
					<input
						id="release-int"
						type="number"
						min="1"
						max="30"
						value={round.releaseInterval}
						onchange={(e) => updateInterval('releaseInterval', parseInt(e.currentTarget.value) || 5)}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-center text-gray-900 dark:text-gray-100"
					/>
				</div>
				<div>
					<label for="call-int" class="block text-xs text-gray-500 dark:text-gray-500 mb-1">Call</label>
					<input
						id="call-int"
						type="number"
						min="1"
						max="30"
						value={round.callInterval}
						onchange={(e) => updateInterval('callInterval', parseInt(e.currentTarget.value) || 2)}
						class="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-center text-gray-900 dark:text-gray-100"
					/>
				</div>
			</div>
		</div>

		<!-- Settings -->
		<div class="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-3">
			<h3 class="text-sm font-medium text-gray-600 dark:text-gray-400">Settings</h3>

			<label class="flex items-center justify-between cursor-pointer">
				<span class="text-sm text-gray-700 dark:text-gray-300">Audio Alerts</span>
				<button
					role="switch"
					aria-checked={settings.audioEnabled}
					aria-label="Toggle audio alerts"
					class="relative w-11 h-6 rounded-full transition-colors {settings.audioEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}"
					onclick={() => settings.toggleAudio()}
				>
					<span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {settings.audioEnabled ? 'translate-x-5' : ''}"></span>
				</button>
			</label>

			<label class="flex items-center justify-between cursor-pointer">
				<span class="text-sm text-gray-700 dark:text-gray-300">Dark Mode</span>
				<button
					role="switch"
					aria-checked={settings.darkMode}
					aria-label="Toggle dark mode"
					class="relative w-11 h-6 rounded-full transition-colors {settings.darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}"
					onclick={() => settings.toggleDarkMode()}
				>
					<span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {settings.darkMode ? 'translate-x-5' : ''}"></span>
				</button>
			</label>

			<label class="flex items-center justify-between cursor-pointer">
				<span class="text-sm text-gray-700 dark:text-gray-300">Fullscreen</span>
				<button
					class="px-4 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700"
					onclick={() => {
						if (document.fullscreenElement) {
							document.exitFullscreen();
						} else {
							document.documentElement.requestFullscreen();
						}
					}}
				>
					Toggle
				</button>
			</label>
		</div>
	{:else}
		<div class="text-center text-gray-400 dark:text-gray-500 py-12">
			No round selected.
		</div>
	{/if}
</div>
