import type { Round, ActiveBreak, RoundType } from '$lib/types';
import { browser } from '$app/environment';

function generateId(): string {
	return Math.random().toString(36).substring(2, 9);
}

function createDefaultRound(type: RoundType = 'prelim'): Round {
	const speakerCounts: Record<RoundType, number> = { prelim: 7, quarter: 8, semi: 4, final: 4 };
	const count = speakerCounts[type];
	return {
		id: generateId(),
		type,
		startTime: '09:00',
		speakers: Array.from({ length: count }, (_, i) => ({
			number: i + 1,
			name: ''
		})),
		drawInterval: 7,
		releaseInterval: 5,
		callInterval: 2,
		status: 'upcoming'
	};
}

function loadState() {
	if (!browser) return null;
	try {
		const saved = localStorage.getItem('extemp-tournament');
		return saved ? JSON.parse(saved) : null;
	} catch {
		return null;
	}
}

const saved = loadState();

let rounds = $state<Round[]>(saved?.rounds ?? [createDefaultRound()]);
let currentRoundIndex = $state<number>(saved?.currentRoundIndex ?? 0);
let activeBreak = $state<ActiveBreak | null>(saved?.activeBreak ?? null);

function save() {
	if (!browser) return;
	localStorage.setItem('extemp-tournament', JSON.stringify({
		rounds,
		currentRoundIndex,
		activeBreak
	}));
}

export const tournament = {
	get rounds() { return rounds; },
	get currentRoundIndex() { return currentRoundIndex; },
	get currentRound(): Round | undefined { return rounds[currentRoundIndex]; },
	get activeBreak() { return activeBreak; },

	setCurrentRoundIndex(index: number) {
		currentRoundIndex = index;
		save();
	},

	addRound(type: RoundType = 'prelim') {
		rounds.push(createDefaultRound(type));
		save();
	},

	removeRound(index: number) {
		rounds.splice(index, 1);
		if (currentRoundIndex >= rounds.length) {
			currentRoundIndex = Math.max(0, rounds.length - 1);
		}
		save();
	},

	updateRound(index: number, updates: Partial<Round>) {
		rounds[index] = { ...rounds[index], ...updates };
		save();
	},

	updateSpeakerName(roundIndex: number, speakerIndex: number, name: string) {
		rounds[roundIndex].speakers[speakerIndex].name = name;
		save();
	},

	setSpeakerCount(roundIndex: number, count: number) {
		const round = rounds[roundIndex];
		const current = round.speakers.length;
		if (count > current) {
			for (let i = current; i < count; i++) {
				round.speakers.push({ number: i + 1, name: '' });
			}
		} else if (count < current) {
			round.speakers.splice(count);
		}
		save();
	},

	startBreak(duration: number, label: string = 'Break') {
		activeBreak = { duration, startedAt: Date.now(), label };
		save();
	},

	endBreak() {
		activeBreak = null;
		save();
	},

	activateRound(index: number) {
		rounds.forEach((r, i) => {
			if (i < index) r.status = 'completed';
			else if (i === index) r.status = 'active';
			else r.status = 'upcoming';
		});
		currentRoundIndex = index;
		save();
	}
};
