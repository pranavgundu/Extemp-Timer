<script lang="ts">
	import type { SpeakerStatus } from '$lib/types';

	let { status }: { status: SpeakerStatus } = $props();

	const config: Record<SpeakerStatus, { label: string; classes: string }> = {
		waiting: { label: 'Waiting', classes: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' },
		called: { label: 'Call', classes: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
		drawing: { label: 'Draw', classes: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200' },
		preparing: { label: 'Prep', classes: 'bg-sky-100 text-sky-800 dark:bg-sky-900 dark:text-sky-200' },
		released: { label: 'Release', classes: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' },
		speaking: { label: 'Speaking', classes: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
		done: { label: 'Done', classes: 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400' },
	};

	let current = $derived(config[status]);
</script>

<span class="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold {current.classes}">
	{current.label}
</span>
