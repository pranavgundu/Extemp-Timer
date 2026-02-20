import type { Round, SpeakerStatus } from '$lib/types';

let now = $state(Date.now());
let interval: ReturnType<typeof setInterval> | null = null;

export function startClock() {
	if (interval) return;
	interval = setInterval(() => {
		now = Date.now();
	}, 1000);
}

export function stopClock() {
	if (interval) {
		clearInterval(interval);
		interval = null;
	}
}

export function getNow(): number {
	return now;
}

export function parseStartTime(timeStr: string): Date {
	const [hours, minutes] = timeStr.split(':').map(Number);
	const date = new Date();
	date.setHours(hours, minutes, 0, 0);
	return date;
}

export function getSpeakerTimes(round: Round, speakerIndex: number) {
	const start = parseStartTime(round.startTime);
	const drawTime = new Date(start.getTime() + speakerIndex * round.drawInterval * 60000);
	const callTime = new Date(drawTime.getTime() - round.callInterval * 60000);
	const speakTime = new Date(drawTime.getTime() + 30 * 60000);
	const releaseTime = new Date(speakTime.getTime() - round.releaseInterval * 60000);
	const speakEndTime = new Date(speakTime.getTime() + 7 * 60000);

	return { callTime, drawTime, releaseTime, speakTime, speakEndTime };
}

export function getSpeakerStatus(round: Round, speakerIndex: number, currentTime: number): SpeakerStatus {
	const { callTime, drawTime, releaseTime, speakTime, speakEndTime } = getSpeakerTimes(round, speakerIndex);
	const t = currentTime;

	if (t >= speakEndTime.getTime()) return 'done';
	if (t >= speakTime.getTime()) return 'speaking';
	if (t >= releaseTime.getTime()) return 'released';
	if (t >= drawTime.getTime() + 60000) return 'preparing';
	if (t >= drawTime.getTime()) return 'drawing';
	if (t >= callTime.getTime()) return 'called';
	return 'waiting';
}
