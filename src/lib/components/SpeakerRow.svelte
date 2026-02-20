<script lang="ts">
	import type { Round, SpeakerStatus } from '$lib/types';
	import { getSpeakerTimes, getSpeakerStatus, getNow } from '$lib/stores/timer.svelte';
	import { alerts } from '$lib/audio';
	import { settings } from '$lib/stores/settings.svelte';
	import StatusBadge from './StatusBadge.svelte';
	import { tournament } from '$lib/stores/tournament.svelte';

	let { round, speakerIndex, roundIndex }: { round: Round; speakerIndex: number; roundIndex: number } = $props();

	let speaker = $derived(round.speakers[speakerIndex]);
	let times = $derived(getSpeakerTimes(round, speakerIndex));
	let status = $derived(getSpeakerStatus(round, speakerIndex, getNow()));
	let isActive = $derived(status === 'speaking' || status === 'drawing' || status === 'released');

	// Audio alerts on status transitions
	let prevStatus = $state<SpeakerStatus | null>(null);

	$effect(() => {
		if (!settings.audioEnabled) {
			prevStatus = status;
			return;
		}
		if (prevStatus !== null && prevStatus !== status) {
			if (status === 'called') alerts.call();
			else if (status === 'drawing') alerts.draw();
			else if (status === 'released') alerts.release();
			else if (status === 'speaking') alerts.speak();
			else if (status === 'done') alerts.done();
		}
		prevStatus = status;
	});

	function formatTime(date: Date): string {
		const h = date.getHours() % 12 || 12;
		const m = date.getMinutes().toString().padStart(2, '0');
		return `${h}:${m}`;
	}

	const rowColors: Record<SpeakerStatus, string> = {
		waiting: '',
		called: 'bg-amber-50 dark:bg-amber-950/30',
		drawing: 'bg-emerald-50 dark:bg-emerald-950/30',
		preparing: 'bg-sky-50 dark:bg-sky-950/30',
		released: 'bg-orange-50 dark:bg-orange-950/30',
		speaking: 'bg-red-50 dark:bg-red-950/30',
		done: 'bg-gray-50 dark:bg-gray-800/50 opacity-60',
	};
</script>

<tr class="border-b border-gray-100 dark:border-gray-800 transition-colors {rowColors[status]} {isActive ? 'ring-2 ring-inset ring-blue-400 dark:ring-blue-500' : ''}">
	<td class="px-3 py-3 text-center font-semibold text-gray-500 dark:text-gray-400 w-10">
		{speaker.number}
	</td>
	<td class="px-3 py-3">
		<input
			type="text"
			value={speaker.name}
			placeholder="Speaker {speaker.number}"
			oninput={(e) => tournament.updateSpeakerName(roundIndex, speakerIndex, e.currentTarget.value)}
			class="w-full bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm focus:ring-1 focus:ring-blue-300 rounded px-1 -mx-1"
		/>
	</td>
	<td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
		{formatTime(times.callTime)}
	</td>
	<td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
		{formatTime(times.drawTime)}
	</td>
	<td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
		{formatTime(times.releaseTime)}
	</td>
	<td class="px-3 py-3 text-center text-sm text-gray-600 dark:text-gray-400 hidden sm:table-cell">
		{formatTime(times.speakTime)}
	</td>
	<td class="px-3 py-3 text-center">
		<StatusBadge {status} />
	</td>
</tr>
