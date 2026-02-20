<script lang="ts">
	import { getNow, startClock } from '$lib/stores/timer.svelte';
	import { onMount } from 'svelte';

	let displayTime = $derived(formatTime(getNow()));

	function formatTime(timestamp: number): string {
		const d = new Date(timestamp);
		const h = d.getHours();
		const m = d.getMinutes().toString().padStart(2, '0');
		const s = d.getSeconds().toString().padStart(2, '0');
		const ampm = h >= 12 ? 'PM' : 'AM';
		const h12 = h % 12 || 12;
		return `${h12}:${m}:${s} ${ampm}`;
	}

	onMount(() => {
		startClock();
	});
</script>

<div class="text-center py-4">
	<time class="font-mono text-5xl sm:text-7xl font-bold tracking-tight text-gray-900 dark:text-gray-100">
		{displayTime}
	</time>
</div>
