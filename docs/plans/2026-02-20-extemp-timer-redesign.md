# Extemp Timer Redesign

## Context
An extemp speaking timer for prep room staff at debate tournaments. Manages speaker call/draw/release/speak times across multiple rounds with a mobile-first, offline-capable interface.

## Goals
- Modern, polished UI that works great on phones (primary device in prep rooms)
- Multi-round tournament management with break timers
- Elimination round support (quarters, semis, finals)
- Audio alerts for status changes
- Full offline support (PWA)
- Persistent state across browser sessions

## Tech Stack
- **SvelteKit** with `@sveltejs/adapter-static` for zero-server static export
- **Tailwind CSS v4** for utility-first responsive styling
- **Svelte stores** for reactive state management
- **localStorage** for persistence
- **Web Audio API** for programmatic alert tones
- **Service Worker** for offline capability

## Architecture
- Single-page app with tab/view navigation (client-side only)
- All state in Svelte stores, synced to localStorage
- Timer uses `setInterval` + `Date.now()` for drift-free accuracy
- Static export produces a folder of HTML/CSS/JS deployable anywhere

## Views

### 1. Round Timer (Main View)
- Large clock (HH:MM:SS) at top
- Speaker table: `#`, `Name`, `Call`, `Draw`, `Release`, `Speak`, `Status`
- Color-coded rows by status (accessible contrast):
  - Waiting (slate) -> Called (amber) -> Drawing (emerald) -> Preparing (sky) -> Released (orange) -> Speaking (red) -> Done (gray)
- Editable speaker names (tap to edit)
- Active speaker row has visual emphasis (pulse animation)
- Round progress bar at top

### 2. Round Setup
- Round type selector: Prelim / Quarter / Semi / Final (with presets)
- Touch-friendly start time picker
- Configurable: speaker count, draw interval, release interval, call interval
- Save configuration as reusable preset

### 3. Tournament Manager
- Round list with statuses (upcoming / active / completed)
- Add/remove rounds
- Break timer between rounds (big fullscreen countdown)
- Quick-advance to next round
- Auto-suggest next round start time based on previous round

### Cross-Cutting Features
- Audio alerts with toggle (Web Audio API generated tones)
- Dark mode toggle
- Fullscreen mode (hide browser chrome)
- Persistent state via localStorage (survives refresh/close)

## Responsive Design

### Mobile (< 640px)
- Bottom tab bar (Timer | Setup | Tournament)
- Compact table showing #, Name, Status; times in condensed format
- Large touch targets (44px minimum)
- Clock fills top 20% of screen

### Tablet/Desktop (640px+)
- Top navigation bar
- Full table with all columns
- Slide-out settings sidebar
- Clock + table can sit side-by-side on wide screens

## Data Model

```
tournamentStore: {
  rounds: Round[],
  currentRoundIndex: number,
  activeBreak: Break | null
}

Round: {
  id: string,
  type: 'prelim' | 'quarter' | 'semi' | 'final',
  startTime: string (HH:MM),
  speakers: Speaker[],
  drawInterval: number (minutes, default: 7),
  releaseInterval: number (minutes, default: 5),
  callInterval: number (minutes, default: 2),
  status: 'upcoming' | 'active' | 'completed'
}

Speaker: {
  number: number,
  name: string,
  callTime: computed (drawTime - callInterval),
  drawTime: computed (startTime + number * drawInterval),
  releaseTime: computed (speakTime - releaseInterval),
  speakTime: computed (drawTime + 30 min),
  speakEndTime: computed (speakTime + 7 min),
  status: computed from current time vs these boundaries
}

Break: {
  duration: number (minutes),
  startedAt: Date,
  label: string
}

settingsStore: {
  audioEnabled: boolean,
  darkMode: boolean,
  presets: RoundPreset[]
}
```

## Timing Logic
All speaker times are derived from round config, not stored:
- `drawTime = roundStartTime + (speakerIndex * drawInterval)`
- `callTime = drawTime - callInterval`
- `speakTime = drawTime + 30 minutes`
- `releaseTime = speakTime - releaseInterval`
- `speakEndTime = speakTime + 7 minutes`

Status computed by comparing `Date.now()` against boundaries every 1 second.

## Visual Design
- System font stack (fast, native feel) + monospace for clock
- Rounded corners, subtle shadows, generous spacing
- Light theme (default, high-contrast) and dark theme
- Subtle pulse animation on active speaker row
- Smooth CSS transitions between status changes

## Break Timer UI
When active, replaces main view with fullscreen countdown:
- Large centered MM:SS countdown
- "Next round starts in..." label
- Round info below
- "End break early" button
