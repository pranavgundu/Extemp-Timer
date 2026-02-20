let audioContext: AudioContext | null = null;

function getContext(): AudioContext {
	if (!audioContext) {
		audioContext = new AudioContext();
	}
	return audioContext;
}

export function playTone(frequency: number = 880, duration: number = 200, volume: number = 0.3) {
	try {
		const ctx = getContext();
		const oscillator = ctx.createOscillator();
		const gain = ctx.createGain();

		oscillator.type = 'sine';
		oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
		gain.gain.setValueAtTime(volume, ctx.currentTime);
		gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

		oscillator.connect(gain);
		gain.connect(ctx.destination);

		oscillator.start(ctx.currentTime);
		oscillator.stop(ctx.currentTime + duration / 1000);
	} catch {
		// Audio not available
	}
}

export const alerts = {
	call: () => {
		playTone(660, 150);
		setTimeout(() => playTone(660, 150), 200);
	},
	draw: () => {
		playTone(880, 300);
	},
	release: () => {
		playTone(784, 150);
		setTimeout(() => playTone(988, 200), 200);
	},
	speak: () => {
		playTone(523, 150);
		setTimeout(() => playTone(659, 150), 180);
		setTimeout(() => playTone(784, 300), 360);
	},
	done: () => {
		playTone(784, 100);
		setTimeout(() => playTone(659, 100), 130);
		setTimeout(() => playTone(523, 200), 260);
	},
	breakEnd: () => {
		playTone(523, 200);
		setTimeout(() => playTone(659, 200), 250);
		setTimeout(() => playTone(784, 200), 500);
		setTimeout(() => playTone(1047, 400), 750);
	}
};
