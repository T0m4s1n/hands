/**
 * Nintendo-feel cafe audio.
 *
 * Short cues are synthesized chirps (Web Audio) with Kenney Digital samples
 * layered on top when the files are present. Music, room tone, and work beds
 * live in `audioWorld` — same cartoon voicing, looping.
 */

import { applyAmbience, applyMusic, applyWork } from "./audioWorld";

export type SfxId =
  | "click"
  | "select"
  | "confirm"
  | "drop"
  | "grab"
  | "pour"
  | "tick"
  | "open"
  | "error"
  | "switch"
  | "win"
  | "stage"
  | "tamp"
  | "grind"
  | "lock"
  | "cheer"
  | "hurry"
  | "near"
  | "splash"
  | "clink"
  | "land"
  | "page"
  | "whoosh"
  | "heart"
  | "foam"
  | "steam"
  | "go"
  | "sync";

export type MusicBed =
  | "off"
  | "sync"
  | "menu"
  | "brief"
  | "count"
  | "play"
  | "results";

export type WorkLoop = "pour" | "grind" | "extract" | "foam" | null;

type Tone = {
  f: number;
  d: number;
  type: OscillatorType;
  gap?: number;
  sweep?: number;
};

const CHIRP: Record<SfxId, readonly Tone[]> = {
  click: [{ f: 920, d: 0.045, type: "square" }],
  select: [
    { f: 740, d: 0.05, type: "square" },
    { f: 980, d: 0.07, type: "square", gap: 0.04 },
  ],
  confirm: [
    { f: 523, d: 0.07, type: "square" },
    { f: 659, d: 0.08, type: "square", gap: 0.06 },
    { f: 784, d: 0.14, type: "triangle", gap: 0.12 },
  ],
  drop: [{ f: 220, d: 0.09, type: "triangle", sweep: -70 }],
  grab: [{ f: 420, d: 0.06, type: "square", sweep: 160 }],
  pour: [
    { f: 340, d: 0.16, type: "sine", sweep: -80 },
    { f: 190, d: 0.2, type: "sine", gap: 0.04, sweep: -40 },
  ],
  tick: [{ f: 880, d: 0.07, type: "square" }],
  open: [
    { f: 392, d: 0.08, type: "triangle" },
    { f: 523, d: 0.12, type: "triangle", gap: 0.07 },
  ],
  error: [
    { f: 196, d: 0.12, type: "square" },
    { f: 147, d: 0.16, type: "square", gap: 0.1 },
  ],
  switch: [
    { f: 330, d: 0.05, type: "square" },
    { f: 494, d: 0.08, type: "square", gap: 0.05 },
  ],
  win: [
    { f: 523, d: 0.08, type: "square" },
    { f: 659, d: 0.08, type: "square", gap: 0.07 },
    { f: 784, d: 0.08, type: "square", gap: 0.14 },
    { f: 1046, d: 0.22, type: "triangle", gap: 0.22 },
  ],
  stage: [
    { f: 587, d: 0.06, type: "square" },
    { f: 740, d: 0.1, type: "triangle", gap: 0.05 },
  ],
  tamp: [{ f: 140, d: 0.08, type: "triangle", sweep: -50 }],
  grind: [
    { f: 110, d: 0.05, type: "square" },
    { f: 180, d: 0.04, type: "square", gap: 0.04 },
  ],
  lock: [
    { f: 392, d: 0.05, type: "square" },
    { f: 523, d: 0.09, type: "triangle", gap: 0.05 },
  ],
  cheer: [
    { f: 659, d: 0.06, type: "square" },
    { f: 784, d: 0.06, type: "square", gap: 0.05 },
    { f: 988, d: 0.12, type: "triangle", gap: 0.1 },
  ],
  hurry: [
    { f: 880, d: 0.05, type: "square" },
    { f: 988, d: 0.05, type: "square", gap: 0.05 },
    { f: 1174, d: 0.08, type: "square", gap: 0.1 },
  ],
  near: [{ f: 620, d: 0.04, type: "triangle", sweep: 80 }],
  splash: [
    { f: 280, d: 0.1, type: "sine", sweep: -90 },
    { f: 180, d: 0.14, type: "sine", gap: 0.03, sweep: -50 },
  ],
  clink: [
    { f: 1480, d: 0.05, type: "sine" },
    { f: 1960, d: 0.07, type: "sine", gap: 0.02 },
  ],
  land: [
    { f: 330, d: 0.05, type: "triangle" },
    { f: 494, d: 0.08, type: "triangle", gap: 0.04 },
  ],
  page: [
    { f: 300, d: 0.04, type: "triangle", sweep: 120 },
    { f: 520, d: 0.06, type: "triangle", gap: 0.03 },
  ],
  whoosh: [{ f: 240, d: 0.22, type: "sine", sweep: 420 }],
  heart: [
    { f: 698, d: 0.06, type: "triangle" },
    { f: 880, d: 0.1, type: "triangle", gap: 0.05 },
  ],
  foam: [{ f: 2100, d: 0.09, type: "sine", sweep: 400 }],
  steam: [{ f: 1600, d: 0.18, type: "sine", sweep: 200 }],
  go: [
    { f: 523, d: 0.07, type: "square" },
    { f: 659, d: 0.07, type: "square", gap: 0.06 },
    { f: 784, d: 0.07, type: "square", gap: 0.12 },
    { f: 1046, d: 0.2, type: "triangle", gap: 0.2 },
  ],
  sync: [
    { f: 349, d: 0.07, type: "triangle" },
    { f: 440, d: 0.1, type: "triangle", gap: 0.06 },
  ],
};

const FILE: Partial<Record<SfxId, string>> = {
  click: "/audio/ui-click.wav",
  select: "/audio/digital/pepSound1.mp3",
  confirm: "/audio/digital/powerUp7.mp3",
  drop: "/audio/ui-drop.wav",
  grab: "/audio/digital/pepSound2.mp3",
  pour: "/audio/fx-glass.wav",
  tick: "/audio/ui-bong.wav",
  open: "/audio/ui-open.wav",
  error: "/audio/ui-error.wav",
  switch: "/audio/ui-switch.wav",
  win: "/audio/digital/threeTone1.mp3",
  stage: "/audio/digital/twoTone1.mp3",
  tamp: "/audio/digital/lowDown.mp3",
  grind: "/audio/digital/pepSound3.mp3",
  lock: "/audio/digital/pepSound3.mp3",
  cheer: "/audio/digital/tone1.mp3",
  hurry: "/audio/digital/zap1.mp3",
  near: "/audio/ui-select.wav",
  splash: "/audio/fx-glass.wav",
  clink: "/audio/ui-pluck.wav",
  land: "/audio/digital/highUp.mp3",
  page: "/audio/ui-open.wav",
  whoosh: "/audio/digital/phaserUp1.mp3",
  heart: "/audio/digital/pepSound4.mp3",
  go: "/audio/digital/powerUp12.mp3",
  sync: "/audio/digital/phaseJump1.mp3",
};

const DEBOUNCE: Partial<Record<SfxId, number>> = {
  click: 80,
  select: 110,
  pour: 420,
  grab: 140,
  drop: 140,
  tick: 200,
  tamp: 160,
  grind: 90,
  near: 420,
  splash: 500,
  clink: 280,
  foam: 180,
  steam: 400,
  page: 160,
  whoosh: 500,
  hurry: 2400,
  cheer: 400,
  heart: 320,
};

let ctx: AudioContext | null = null;
const lastPlayed = new Map<SfxId, number>();
const buffers = new Map<string, AudioBuffer>();

export function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  return ctx;
}

export function unlockAudio() {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}

export function setMusic(bed: MusicBed) {
  unlockAudio();
  applyMusic(getAudioContext(), bed);
}

export function setAmbience(level: number) {
  unlockAudio();
  applyAmbience(getAudioContext(), level);
}

export function setWorkLoop(id: WorkLoop) {
  unlockAudio();
  applyWork(getAudioContext(), id);
}

export function playSfx(id: SfxId, opts?: { force?: boolean }) {
  const audio = getAudioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();

  const now = performance.now();
  const wait = DEBOUNCE[id] ?? 70;
  if (!opts?.force && now - (lastPlayed.get(id) ?? 0) < wait) return;
  lastPlayed.set(id, now);

  const file = FILE[id];
  if (file) playFile(audio, file, gainFor(id));
  chirp(audio, CHIRP[id], gainFor(id) * (file ? 0.45 : 1));
}

function gainFor(id: SfxId) {
  if (id === "win" || id === "go") return 0.5;
  if (id === "confirm" || id === "stage" || id === "cheer") return 0.42;
  if (id === "error" || id === "hurry") return 0.38;
  if (id === "near" || id === "page" || id === "clink") return 0.26;
  return 0.32;
}

function chirp(audio: AudioContext, tones: readonly Tone[], gain: number) {
  let t = audio.currentTime;
  for (const tone of tones) {
    t += tone.gap ?? 0;
    const osc = audio.createOscillator();
    const amp = audio.createGain();
    osc.type = tone.type;
    osc.frequency.setValueAtTime(tone.f, t);
    if (tone.sweep) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, tone.f + tone.sweep),
        t + tone.d,
      );
    }
    amp.gain.setValueAtTime(gain, t);
    amp.gain.exponentialRampToValueAtTime(0.001, t + tone.d);
    osc.connect(amp).connect(audio.destination);
    osc.start(t);
    osc.stop(t + tone.d + 0.02);
  }
}

function playFile(audio: AudioContext, url: string, gain: number) {
  const play = (buffer: AudioBuffer) => {
    const src = audio.createBufferSource();
    const amp = audio.createGain();
    src.buffer = buffer;
    amp.gain.value = gain;
    src.connect(amp).connect(audio.destination);
    src.start();
  };
  const ready = buffers.get(url);
  if (ready) {
    play(ready);
    return;
  }
  void fetch(url)
    .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
    .then((raw) => audio.decodeAudioData(raw))
    .then((buffer) => {
      buffers.set(url, buffer);
      play(buffer);
    })
    .catch(() => {
      /* chirp already played */
    });
}

export function preloadSfx() {
  const audio = getAudioContext();
  if (!audio) return;
  for (const url of Object.values(FILE)) {
    if (buffers.has(url)) continue;
    void fetch(url)
      .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject()))
      .then((raw) => audio.decodeAudioData(raw))
      .then((buffer) => buffers.set(url, buffer))
      .catch(() => {
        /* optional */
      });
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
