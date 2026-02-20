# Extemp Timer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a mobile-first PWA for prep room staff to manage extemp speaking rounds at debate tournaments — tracking speaker call/draw/release/speak times across multiple rounds with break timers, audio alerts, and offline support.

**Architecture:** SvelteKit SPA with static adapter, all state in Svelte 5 runes synced to localStorage, timer driven by setInterval + Date.now(). Three views: Round Timer, Round Setup, Tournament Manager. Bottom tab nav on mobile, top nav on desktop.

**Tech Stack:** SvelteKit + adapter-static, Svelte 5 (runes), Tailwind CSS v4 (@tailwindcss/vite), Web Audio API, Service Worker via @vite-pwa/sveltekit

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `svelte.config.js`, `vite.config.ts`, `src/app.html`, `src/app.css`, `src/routes/+layout.svelte`, `src/routes/+layout.js`, `src/routes/+page.svelte`

**Step 1: Scaffold SvelteKit project**

Run:
```bash
npx sv create . --template minimal --types ts
```
Select: No additional options (we'll install manually)

**Step 2: Install dependencies**

Run:
```bash
npm install
npm install -D tailwindcss @tailwindcss/vite @sveltejs/adapter-static
```

**Step 3: Configure adapter-static**

Update `svelte.config.js`:
```js
import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      pages: 'build',
      assets: 'build',
      fallback: 'index.html',
      strict: false
    })
  }
};
```

**Step 4: Configure Tailwind v4 in Vite**

Update `vite.config.ts`:
```ts
import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit()
  ]
});
```

**Step 5: Set up global CSS**

Write `src/app.css`:
```css
@import "tailwindcss";
```

**Step 6: Set up root layout**

Write `src/routes/+layout.svelte`:
```svelte
<script>
  import "../app.css";
  let { children } = $props();
</script>

{@render children()}
```

Write `src/routes/+layout.js`:
```js
export const prerender = true;
export const ssr = false;
```

**Step 7: Verify dev server works**

Write `src/routes/+page.svelte`:
```svelte
<h1 class="text-3xl font-bold p-8">Extemp Timer</h1>
```

Run: `npm run dev`
Expected: Page renders with styled heading at localhost:5173

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with Tailwind v4 and static adapter"
```

---

## Task 2: Data Stores & Timing Logic

**Files:**
- Create: `src/lib/stores/tournament.svelte.ts`
- Create: `src/lib/stores/settings.svelte.ts`
- Create: `src/lib/stores/timer.svelte.ts`
- Create: `src/lib/types.ts`

**Step 1: Define types**

Write `src/lib/types.ts`:
```ts
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
```

**Step 2: Create timing logic**

Write `src/lib/stores/timer.svelte.ts`:
```ts
import type { Round, Speaker, SpeakerStatus } from '$lib/types';

// Reactive current time updated every second
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

// Parse "HH:MM" into a Date object for today
export function parseStartTime(timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

// Compute speaker times from round config
export function getSpeakerTimes(round: Round, speakerIndex: number) {
  const start = parseStartTime(round.startTime);
  const drawTime = new Date(start.getTime() + speakerIndex * round.drawInterval * 60000);
  const callTime = new Date(drawTime.getTime() - round.callInterval * 60000);
  const speakTime = new Date(drawTime.getTime() + 30 * 60000);
  const releaseTime = new Date(speakTime.getTime() - round.releaseInterval * 60000);
  const speakEndTime = new Date(speakTime.getTime() + 7 * 60000);

  return { callTime, drawTime, releaseTime, speakTime, speakEndTime };
}

// Determine speaker status from current time
export function getSpeakerStatus(round: Round, speakerIndex: number, currentTime: number): SpeakerStatus {
  const { callTime, drawTime, releaseTime, speakTime, speakEndTime } = getSpeakerTimes(round, speakerIndex);
  const t = currentTime;

  if (t >= speakEndTime.getTime()) return 'done';
  if (t >= speakTime.getTime()) return 'speaking';
  if (t >= releaseTime.getTime()) return 'released';
  if (t >= drawTime.getTime() + 60000) return 'preparing'; // 1 min draw window
  if (t >= drawTime.getTime()) return 'drawing';
  if (t >= callTime.getTime()) return 'called';
  return 'waiting';
}
```

**Step 3: Create tournament store**

Write `src/lib/stores/tournament.svelte.ts`:
```ts
import type { Round, ActiveBreak } from '$lib/types';
import { browser } from '$app/environment';

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

function createDefaultRound(type: 'prelim' | 'quarter' | 'semi' | 'final' = 'prelim'): Round {
  const speakerCounts = { prelim: 7, quarter: 8, semi: 4, final: 4 };
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

// Load from localStorage
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

// Persist to localStorage on changes
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

  addRound(type: 'prelim' | 'quarter' | 'semi' | 'final' = 'prelim') {
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
    // Set all rounds to appropriate status
    rounds.forEach((r, i) => {
      if (i < index) r.status = 'completed';
      else if (i === index) r.status = 'active';
      else r.status = 'upcoming';
    });
    currentRoundIndex = index;
    save();
  }
};
```

**Step 4: Create settings store**

Write `src/lib/stores/settings.svelte.ts`:
```ts
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
```

**Step 5: Verify build compiles**

Run: `npm run dev`
Expected: No errors

**Step 6: Commit**

```bash
git add src/lib/
git commit -m "feat: add data stores, types, and timing logic"
```

---

## Task 3: Audio Alert System

**Files:**
- Create: `src/lib/audio.ts`

**Step 1: Create Web Audio API alert system**

Write `src/lib/audio.ts`:
```ts
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

// Distinct alert sounds for each status change
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
```

**Step 2: Commit**

```bash
git add src/lib/audio.ts
git commit -m "feat: add Web Audio API alert system with distinct tones"
```

---

## Task 4: Shared UI Components

**Files:**
- Create: `src/lib/components/Clock.svelte`
- Create: `src/lib/components/TabBar.svelte`
- Create: `src/lib/components/StatusBadge.svelte`

**Step 1: Build the clock component**

Write `src/lib/components/Clock.svelte`:
```svelte
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
```

**Step 2: Build the tab bar**

Write `src/lib/components/TabBar.svelte`:
```svelte
<script lang="ts">
  interface Tab {
    id: string;
    label: string;
    icon: string;
  }

  let { activeTab = $bindable(), tabs }: { activeTab: string; tabs: Tab[] } = $props();
</script>

<!-- Mobile: bottom tab bar -->
<nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 sm:hidden z-50">
  <div class="flex justify-around">
    {#each tabs as tab}
      <button
        class="flex flex-col items-center py-2 px-4 text-xs font-medium transition-colors {activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}"
        onclick={() => activeTab = tab.id}
      >
        <span class="text-xl mb-0.5">{tab.icon}</span>
        {tab.label}
      </button>
    {/each}
  </div>
</nav>

<!-- Desktop: top nav -->
<nav class="hidden sm:flex justify-center gap-1 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
  {#each tabs as tab}
    <button
      class="px-5 py-2 rounded-lg text-sm font-medium transition-colors {activeTab === tab.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'}"
      onclick={() => activeTab = tab.id}
    >
      <span class="mr-1.5">{tab.icon}</span>
      {tab.label}
    </button>
  {/each}
</nav>
```

**Step 3: Build status badge**

Write `src/lib/components/StatusBadge.svelte`:
```svelte
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
```

**Step 4: Commit**

```bash
git add src/lib/components/
git commit -m "feat: add Clock, TabBar, and StatusBadge components"
```

---

## Task 5: Round Timer View (Main View)

**Files:**
- Create: `src/lib/components/RoundTimer.svelte`
- Create: `src/lib/components/SpeakerRow.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Build speaker row component**

Write `src/lib/components/SpeakerRow.svelte`:
```svelte
<script lang="ts">
  import type { Round, SpeakerStatus } from '$lib/types';
  import { getSpeakerTimes, getSpeakerStatus, getNow } from '$lib/stores/timer.svelte';
  import StatusBadge from './StatusBadge.svelte';
  import { tournament } from '$lib/stores/tournament.svelte';

  let { round, speakerIndex, roundIndex }: { round: Round; speakerIndex: number; roundIndex: number } = $props();

  let speaker = $derived(round.speakers[speakerIndex]);
  let times = $derived(getSpeakerTimes(round, speakerIndex));
  let status = $derived(getSpeakerStatus(round, speakerIndex, getNow()));
  let isActive = $derived(status === 'speaking' || status === 'drawing' || status === 'released');

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
```

**Step 2: Build round timer view**

Write `src/lib/components/RoundTimer.svelte`:
```svelte
<script lang="ts">
  import Clock from './Clock.svelte';
  import SpeakerRow from './SpeakerRow.svelte';
  import { tournament } from '$lib/stores/tournament.svelte';
  import { getNow, getSpeakerStatus } from '$lib/stores/timer.svelte';

  let round = $derived(tournament.currentRound);
  let roundIndex = $derived(tournament.currentRoundIndex);

  // Calculate round progress
  let progress = $derived.by(() => {
    if (!round) return 0;
    const total = round.speakers.length;
    let done = 0;
    for (let i = 0; i < total; i++) {
      const s = getSpeakerStatus(round, i, getNow());
      if (s === 'done') done++;
    }
    return Math.round((done / total) * 100);
  });
</script>

<div class="flex flex-col h-full">
  {#if round}
    <!-- Progress bar -->
    <div class="h-1.5 bg-gray-200 dark:bg-gray-700 w-full">
      <div
        class="h-full bg-blue-500 transition-all duration-1000 ease-linear"
        style="width: {progress}%"
      ></div>
    </div>

    <Clock />

    <!-- Round info -->
    <div class="text-center text-sm text-gray-500 dark:text-gray-400 pb-3">
      Round {roundIndex + 1} &middot; {round.type.charAt(0).toUpperCase() + round.type.slice(1)} &middot; {round.speakers.length} speakers
    </div>

    <!-- Speaker table -->
    <div class="flex-1 overflow-auto px-2 sm:px-6 pb-20 sm:pb-4">
      <table class="w-full">
        <thead>
          <tr class="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500 border-b border-gray-200 dark:border-gray-700">
            <th class="px-3 py-2 text-center w-10">#</th>
            <th class="px-3 py-2 text-left">Name</th>
            <th class="px-3 py-2 text-center hidden sm:table-cell">Call</th>
            <th class="px-3 py-2 text-center hidden sm:table-cell">Draw</th>
            <th class="px-3 py-2 text-center hidden sm:table-cell">Release</th>
            <th class="px-3 py-2 text-center hidden sm:table-cell">Speak</th>
            <th class="px-3 py-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {#each round.speakers as _, i}
            <SpeakerRow {round} speakerIndex={i} {roundIndex} />
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
      No rounds configured. Go to Setup to add one.
    </div>
  {/if}
</div>
```

**Step 3: Wire into page**

Write `src/routes/+page.svelte`:
```svelte
<script lang="ts">
  import TabBar from '$lib/components/TabBar.svelte';
  import RoundTimer from '$lib/components/RoundTimer.svelte';
  import { settings } from '$lib/stores/settings.svelte';

  let activeTab = $state('timer');

  const tabs = [
    { id: 'timer', label: 'Timer', icon: '⏱' },
    { id: 'setup', label: 'Setup', icon: '⚙' },
    { id: 'tournament', label: 'Rounds', icon: '📋' },
  ];
</script>

<svelte:head>
  <title>Extemp Timer</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
</svelte:head>

<div class="min-h-dvh flex flex-col {settings.darkMode ? 'dark' : ''}">
  <div class="flex-1 flex flex-col bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
    <TabBar {tabs} bind:activeTab />

    <main class="flex-1 flex flex-col overflow-hidden">
      {#if activeTab === 'timer'}
        <RoundTimer />
      {:else if activeTab === 'setup'}
        <div class="p-6 text-center text-gray-400">Setup view coming soon</div>
      {:else if activeTab === 'tournament'}
        <div class="p-6 text-center text-gray-400">Tournament view coming soon</div>
      {/if}
    </main>
  </div>
</div>
```

**Step 4: Verify timer view renders**

Run: `npm run dev`
Expected: Clock ticking, speaker table with 7 rows, status badges updating in real time

**Step 5: Commit**

```bash
git add src/lib/components/ src/routes/+page.svelte
git commit -m "feat: add round timer view with speaker table and live status"
```

---

## Task 6: Round Setup View

**Files:**
- Create: `src/lib/components/RoundSetup.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Build setup view**

Write `src/lib/components/RoundSetup.svelte`:
```svelte
<script lang="ts">
  import { tournament } from '$lib/stores/tournament.svelte';
  import { settings } from '$lib/stores/settings.svelte';
  import type { RoundType } from '$lib/types';

  let roundIndex = $derived(tournament.currentRoundIndex);
  let round = $derived(tournament.currentRound);

  function updateType(type: RoundType) {
    if (!round) return;
    const speakerCounts = { prelim: 7, quarter: 8, semi: 4, final: 4 };
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
      <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Round Type</label>
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
      <label class="block text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">Speakers</label>
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
          class="relative w-11 h-6 rounded-full transition-colors {settings.darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'}"
          onclick={() => settings.toggleDarkMode()}
        >
          <span class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform {settings.darkMode ? 'translate-x-5' : ''}"></span>
        </button>
      </label>
    </div>
  {:else}
    <div class="text-center text-gray-400 dark:text-gray-500 py-12">
      No round selected.
    </div>
  {/if}
</div>
```

**Step 2: Wire into page**

In `src/routes/+page.svelte`, add the import and replace the setup placeholder:

Add import:
```ts
import RoundSetup from '$lib/components/RoundSetup.svelte';
```

Replace:
```svelte
{:else if activeTab === 'setup'}
  <div class="p-6 text-center text-gray-400">Setup view coming soon</div>
```
With:
```svelte
{:else if activeTab === 'setup'}
  <RoundSetup />
```

**Step 3: Verify setup view**

Run: `npm run dev`
Expected: Setup tab shows round type buttons, time picker, speaker count, interval inputs, toggles

**Step 4: Commit**

```bash
git add src/lib/components/RoundSetup.svelte src/routes/+page.svelte
git commit -m "feat: add round setup view with config and settings"
```

---

## Task 7: Tournament Manager View

**Files:**
- Create: `src/lib/components/TournamentManager.svelte`
- Create: `src/lib/components/BreakTimer.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Build break timer component**

Write `src/lib/components/BreakTimer.svelte`:
```svelte
<script lang="ts">
  import { tournament } from '$lib/stores/tournament.svelte';
  import { getNow } from '$lib/stores/timer.svelte';
  import { alerts } from '$lib/audio';
  import { settings } from '$lib/stores/settings.svelte';

  let activeBreak = $derived(tournament.activeBreak);

  let remaining = $derived.by(() => {
    if (!activeBreak) return 0;
    const elapsed = (getNow() - activeBreak.startedAt) / 1000;
    const total = activeBreak.duration * 60;
    return Math.max(0, total - elapsed);
  });

  let minutes = $derived(Math.floor(remaining / 60).toString().padStart(2, '0'));
  let seconds = $derived(Math.floor(remaining % 60).toString().padStart(2, '0'));
  let isExpired = $derived(remaining <= 0 && activeBreak !== null);

  let alertPlayed = $state(false);

  $effect(() => {
    if (isExpired && !alertPlayed) {
      if (settings.audioEnabled) alerts.breakEnd();
      alertPlayed = true;
    }
    if (!isExpired) alertPlayed = false;
  });
</script>

{#if activeBreak}
  <div class="fixed inset-0 bg-white dark:bg-gray-950 z-40 flex flex-col items-center justify-center">
    <p class="text-sm uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">
      {activeBreak.label}
    </p>
    <time class="font-mono text-8xl sm:text-9xl font-bold {isExpired ? 'text-red-500 animate-pulse' : 'text-gray-900 dark:text-gray-100'}">
      {minutes}:{seconds}
    </time>
    <p class="text-gray-500 dark:text-gray-400 mt-4">
      {isExpired ? 'Break is over!' : 'Next round starts soon...'}
    </p>
    <button
      class="mt-8 px-6 py-3 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
      onclick={() => tournament.endBreak()}
    >
      {isExpired ? 'Start Next Round' : 'End Break Early'}
    </button>
  </div>
{/if}
```

**Step 2: Build tournament manager**

Write `src/lib/components/TournamentManager.svelte`:
```svelte
<script lang="ts">
  import { tournament } from '$lib/stores/tournament.svelte';
  import { getSpeakerTimes } from '$lib/stores/timer.svelte';
  import type { RoundType } from '$lib/types';

  let showAddMenu = $state(false);

  function estimateEndTime(roundIndex: number): string {
    const round = tournament.rounds[roundIndex];
    if (!round) return '';
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
    if (!round) return '09:00';
    const lastSpeaker = round.speakers.length - 1;
    const times = getSpeakerTimes(round, lastSpeaker);
    // Suggest 15 min after last speaker finishes
    const suggested = new Date(times.speakEndTime.getTime() + 15 * 60000);
    const h = suggested.getHours().toString().padStart(2, '0');
    const m = suggested.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  function addRound(type: RoundType) {
    tournament.addRound(type);
    // Set suggested start time for the new round
    const newIndex = tournament.rounds.length - 1;
    if (newIndex > 0) {
      tournament.updateRound(newIndex, { startTime: suggestNextStartTime(newIndex - 1) });
    }
    showAddMenu = false;
  }

  function startBreak() {
    tournament.startBreak(15, 'Break');
  }

  let breakDuration = $state(15);
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
    <!-- Add Round -->
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

    <!-- Start Break -->
    <button
      class="flex-1 py-3 rounded-xl bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors"
      onclick={startBreak}
    >
      Start Break
    </button>
  </div>

  <!-- Break duration setting -->
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

  <!-- Remove current round -->
  {#if tournament.rounds.length > 1}
    <button
      class="w-full py-2 text-sm text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300"
      onclick={() => tournament.removeRound(tournament.currentRoundIndex)}
    >
      Remove Round {tournament.currentRoundIndex + 1}
    </button>
  {/if}
</div>
```

**Step 3: Wire into page**

In `src/routes/+page.svelte`, add imports and replace placeholder:

Add imports:
```ts
import TournamentManager from '$lib/components/TournamentManager.svelte';
import BreakTimer from '$lib/components/BreakTimer.svelte';
```

Replace:
```svelte
{:else if activeTab === 'tournament'}
  <div class="p-6 text-center text-gray-400">Tournament view coming soon</div>
```
With:
```svelte
{:else if activeTab === 'tournament'}
  <TournamentManager />
```

Add `<BreakTimer />` just before the closing `</div>` of the main container (so it overlays all views).

**Step 4: Verify tournament view**

Run: `npm run dev`
Expected: Round list, add round menu, break timer countdown overlay

**Step 5: Commit**

```bash
git add src/lib/components/ src/routes/+page.svelte
git commit -m "feat: add tournament manager view with break timer"
```

---

## Task 8: Audio Alert Integration

**Files:**
- Modify: `src/lib/components/SpeakerRow.svelte`

**Step 1: Add alert triggers to speaker rows**

In `SpeakerRow.svelte`, add import and effect to play alerts on status transitions:

Add import:
```ts
import { alerts } from '$lib/audio';
import { settings } from '$lib/stores/settings.svelte';
```

Add tracking state and effect:
```ts
let prevStatus = $state<SpeakerStatus | null>(null);

$effect(() => {
  if (!settings.audioEnabled) return;
  if (prevStatus !== null && prevStatus !== status) {
    if (status === 'called') alerts.call();
    else if (status === 'drawing') alerts.draw();
    else if (status === 'released') alerts.release();
    else if (status === 'speaking') alerts.speak();
    else if (status === 'done') alerts.done();
  }
  prevStatus = status;
});
```

**Step 2: Verify alerts**

Run: `npm run dev`
Expected: When speaker status transitions, a distinct chime plays (if audio is enabled in settings)

**Step 3: Commit**

```bash
git add src/lib/components/SpeakerRow.svelte
git commit -m "feat: integrate audio alerts on speaker status transitions"
```

---

## Task 9: Dark Mode & Global Styles

**Files:**
- Modify: `src/app.css`
- Modify: `src/routes/+page.svelte`

**Step 1: Add dark mode support and base styles**

Update `src/app.css`:
```css
@import "tailwindcss";

@theme {
  --font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', 'Roboto Mono', monospace;
}

html {
  -webkit-tap-highlight-color: transparent;
  overscroll-behavior: none;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

/* Smooth status transitions */
tr {
  transition: background-color 0.5s ease;
}

/* Active speaker pulse */
@keyframes subtle-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.85; }
}

.animate-subtle-pulse {
  animation: subtle-pulse 2s ease-in-out infinite;
}
```

**Step 2: Ensure dark class propagates correctly**

In `src/routes/+page.svelte`, make sure the dark mode class is on the outermost div wrapping the app. The current implementation already does this with `{settings.darkMode ? 'dark' : ''}`.

**Step 3: Verify dark mode**

Run: `npm run dev`
Expected: Toggle dark mode in Setup -> entire app switches theme

**Step 4: Commit**

```bash
git add src/app.css src/routes/+page.svelte
git commit -m "feat: add dark mode support and global styles"
```

---

## Task 10: PWA & Offline Support

**Files:**
- Create: `static/manifest.json`
- Modify: `src/app.html`
- Modify: `vite.config.ts`

**Step 1: Create web manifest**

Write `static/manifest.json`:
```json
{
  "name": "Extemp Timer",
  "short_name": "Extemp",
  "description": "Tournament prep room timer for extemporaneous speaking",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "orientation": "any",
  "theme_color": "#1e40af",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

**Step 2: Add manifest link to app.html**

In `src/app.html`, add inside `<head>`:
```html
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1e40af" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

**Step 3: Create service worker**

Write `src/service-worker.ts`:
```ts
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />
declare const self: ServiceWorkerGlobalScope;

import { build, files, version } from '$service-worker';

const CACHE = `cache-${version}`;
const ASSETS = [...build, ...files];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(async (keys) => {
      for (const key of keys) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
```

**Step 4: Generate placeholder icons**

We can create simple SVG icons as placeholders (or the user can replace with real ones later). For now, create placeholder PNGs by generating them with a canvas script, or use simple colored squares.

**Step 5: Verify PWA**

Run: `npm run build && npx serve build`
Expected: App installs as PWA, works offline

**Step 6: Commit**

```bash
git add static/ src/app.html src/service-worker.ts
git commit -m "feat: add PWA manifest and service worker for offline support"
```

---

## Task 11: Fullscreen Mode & Final Polish

**Files:**
- Modify: `src/lib/components/RoundSetup.svelte`
- Modify: `src/routes/+page.svelte`

**Step 1: Add fullscreen toggle**

In `RoundSetup.svelte`, add a fullscreen toggle in the Settings section:

```svelte
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
```

**Step 2: Verify everything works end-to-end**

Run: `npm run dev`
Expected:
- Timer tab: clock ticking, speaker table updating, color-coded statuses
- Setup tab: all config fields work, dark mode toggles, audio toggles
- Tournament tab: add/remove rounds, break timer overlay, activate rounds
- Responsive: bottom tabs on mobile, top tabs on desktop
- Audio: chimes on status transitions when enabled

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add fullscreen mode and final polish"
```

---

## Summary of Tasks

| Task | Description | Key Files |
|------|-------------|-----------|
| 1 | Project scaffolding | svelte.config.js, vite.config.ts, app.css |
| 2 | Data stores & timing | stores/*.svelte.ts, types.ts |
| 3 | Audio alerts | audio.ts |
| 4 | Shared components | Clock, TabBar, StatusBadge |
| 5 | Round Timer view | RoundTimer, SpeakerRow |
| 6 | Round Setup view | RoundSetup |
| 7 | Tournament Manager | TournamentManager, BreakTimer |
| 8 | Audio integration | SpeakerRow alert triggers |
| 9 | Dark mode & styles | app.css, global theme |
| 10 | PWA & offline | manifest, service worker |
| 11 | Fullscreen & polish | Final integration |
