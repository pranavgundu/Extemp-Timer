import type { RoundPreset } from '$lib/types';
import { browser } from '$app/environment';

function loadSettings() {
	if (!browser) return null;
	try {
		const saved = localStorage.getItem('extemp-settings');
		return saved ? JSON.parse(saved) : null;
	} catch {
		return null;
	}
}

const saved = loadSettings();

let audioEnabled = $state<boolean>(saved?.audioEnabled ?? true);
let darkMode = $state<boolean>(saved?.darkMode ?? false);
let presets = $state<RoundPreset[]>(saved?.presets ?? []);

function save() {
	if (!browser) return;
	localStorage.setItem('extemp-settings', JSON.stringify({
		audioEnabled,
		darkMode,
		presets
	}));
}

export const settings = {
	get audioEnabled() { return audioEnabled; },
	get darkMode() { return darkMode; },
	get presets() { return presets; },

	toggleAudio() {
		audioEnabled = !audioEnabled;
		save();
	},

	toggleDarkMode() {
		darkMode = !darkMode;
		save();
	},

	addPreset(preset: RoundPreset) {
		presets.push(preset);
		save();
	},

	removePreset(id: string) {
		const index = presets.findIndex(p => p.id === id);
		if (index >= 0) presets.splice(index, 1);
		save();
	}
};
