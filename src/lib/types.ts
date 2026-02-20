export type RoundType = 'prelim' | 'quarter' | 'semi' | 'final';
export type RoundStatus = 'upcoming' | 'active' | 'completed';
export type SpeakerStatus = 'waiting' | 'called' | 'drawing' | 'preparing' | 'released' | 'speaking' | 'done';

export interface Speaker {
	number: number;
	name: string;
}

export interface Round {
	id: string;
	type: RoundType;
	startTime: string; // HH:MM 24hr format
	speakers: Speaker[];
	drawInterval: number; // minutes
	releaseInterval: number; // minutes
	callInterval: number; // minutes
	status: RoundStatus;
}

export interface ActiveBreak {
	duration: number; // minutes
	startedAt: number; // timestamp ms
	label: string;
}

export interface RoundPreset {
	id: string;
	name: string;
	type: RoundType;
	speakerCount: number;
	drawInterval: number;
	releaseInterval: number;
	callInterval: number;
}
