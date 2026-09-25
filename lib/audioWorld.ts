/**
 * Looping game music, a quiet room, and work beds.
 *
 * The beds are songs — melody, harmony, bass, drums — not cafe noise.
 * Room tone stays under them so the track still reads as music.
 */

import type { MusicBed, WorkLoop } from "./audio";

type Stop = () => void;

let music: { bed: MusicBed; stop: Stop } | null = null;
let room: { level: number; stop: Stop; master: GainNode } | null = null;
let work: { id: NonNullable<WorkLoop>; stop: Stop } | null = null;

const F2 = 87.31;
const G2 = 98.0;
const A2 = 110.0;
const B2 = 123.47;
const C3 = 130.81;
const D3 = 146.83;
const E3 = 164.81;
const F3 = 174.61;
const G3 = 196.0;
const A3 = 220.0;
const B3 = 246.94;
const C4 = 261.63;
const D4 = 293.66;
const E4 = 329.63;
const F4 = 349.23;
const G4 = 392.0;
const A4 = 440.0;
const B4 = 493.88;
const C5 = 523.25;
const D5 = 587.33;
const E5 = 659.25;
const F5 = 698.46;
const G5 = 783.99;
const A5 = 880.0;

function voice(
  ctx: AudioContext,
  dest: AudioNode,
  type: OscillatorType,
  freq: number,
  time: number,
  dur: number,
  gain: number,
  sweep = 0,
) {
  if (freq <= 0 || gain <= 0) return;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);
  if (sweep !== 0) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, freq + sweep),
      time + dur,
    );
  }
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.018);
  amp.gain.setValueAtTime(gain * 0.82, time + dur * 0.55);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

function lead(
  ctx: AudioContext,
  dest: AudioNode,
  freq: number,
  time: number,
  dur: number,
  gain: number,
) {
  if (freq <= 0 || gain <= 0) return;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(1600, time);
  filter.Q.value = 0.5;
  filter.connect(dest);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.025);
  amp.gain.setValueAtTime(gain * 0.75, time + Math.max(0.04, dur * 0.65));
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  amp.connect(filter);
  const osc = ctx.createOscillator();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(freq, time);
  osc.connect(amp);
  osc.start(time);
  osc.stop(time + dur + 0.03);
}

function kick(ctx: AudioContext, dest: AudioNode, time: number, gain: number) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(148, time);
  osc.frequency.exponentialRampToValueAtTime(48, time + 0.14);
  amp.gain.setValueAtTime(gain, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.16);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.18);
}

function snare(ctx: AudioContext, dest: AudioNode, time: number, gain: number) {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(220, time);
  osc.frequency.exponentialRampToValueAtTime(90, time + 0.08);
  amp.gain.setValueAtTime(gain * 0.45, time);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + 0.09);
  osc.connect(amp).connect(dest);
  osc.start(time);
  osc.stop(time + 0.1);
  hiss(ctx, dest, time, 0.07, gain * 0.55, 2200);
}

function hat(ctx: AudioContext, dest: AudioNode, time: number, gain: number) {
  hiss(ctx, dest, time, 0.035, gain, 7000);
}

function noiseBuffer(ctx: AudioContext, seconds = 2) {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.86 + white * 0.14;
    data[i] = last;
  }
  return buffer;
}

function hiss(
  ctx: AudioContext,
  dest: AudioNode,
  time: number,
  dur: number,
  gain: number,
  cutoff: number,
) {
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  src.buffer = noiseBuffer(ctx, Math.max(0.2, dur + 0.05));
  filter.type = "bandpass";
  filter.frequency.value = cutoff;
  filter.Q.value = 0.9;
  amp.gain.setValueAtTime(0.0001, time);
  amp.gain.exponentialRampToValueAtTime(gain, time + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  src.connect(filter).connect(amp).connect(dest);
  src.start(time);
  src.stop(time + dur + 0.02);
}

/** Same pitch in a row is one held note. 0 is a rest. */
function onset(row: readonly number[], i: number): number {
  const note = row[i] ?? 0;
  if (note <= 0) return 0;
  if (i > 0 && row[i - 1] === note) return 0;
  let steps = 1;
  while (i + steps < row.length && row[i + steps] === note) steps += 1;
  return steps;
}

type Groove = "none" | "soft" | "full" | "march";

type Song = {
  lead: readonly (readonly number[])[];
  bass: readonly (readonly number[])[];
  harmony: readonly (readonly number[])[];
  bpm: number;
  drums: Groove;
};

/** Carta — C major, slow and lyrical. */
const MENU_SONG: Song = {
  bpm: 90,
  drums: "soft",
  lead: [
    [E5, E5, E5, D5, C5, C5, C5, 0, G4, G4, A4, A4, C5, C5, C5, 0],
    [D5, D5, E5, E5, G5, G5, G5, 0, E5, E5, D5, C5, A4, A4, A4, 0],
    [G4, G4, A4, C5, D5, D5, E5, 0, C5, C5, A4, A4, G4, G4, G4, 0],
    [E5, E5, D5, C5, G4, G4, A4, C5, E4, E4, E4, E4, 0, 0, 0, 0],
  ],
  bass: [
    [C3, C3, C3, C3, G2, G2, G2, G2, C3, C3, E3, E3, G2, G2, G2, 0],
    [A2, A2, A2, A2, E3, E3, E3, E3, A2, A2, C3, C3, E3, E3, E3, 0],
    [F2, F2, F2, F2, C3, C3, C3, C3, G2, G2, D3, D3, G2, G2, G2, 0],
    [C3, C3, G2, G2, C3, C3, E3, E3, C3, C3, C3, C3, 0, 0, 0, 0],
  ],
  harmony: [
    [G4, 0, 0, 0, E4, 0, 0, 0, G4, 0, 0, 0, C4, 0, 0, 0],
    [A4, 0, 0, 0, E4, 0, 0, 0, C5, 0, 0, 0, A4, 0, 0, 0],
    [F4, 0, 0, 0, A4, 0, 0, 0, G4, 0, 0, 0, D4, 0, 0, 0],
    [E4, 0, 0, 0, G4, 0, 0, 0, C5, 0, 0, 0, G4, 0, 0, 0],
  ],
};

/** Partida — A minor, bouncy and short. */
const PLAY_SONG: Song = {
  bpm: 128,
  drums: "full",
  lead: [
    [A4, 0, C5, 0, E5, E5, D5, C5, A4, 0, E5, 0, A5, A5, E5, 0],
    [G4, 0, B4, 0, D5, D5, C5, B4, G4, 0, D5, 0, G5, G5, D5, 0],
    [A4, C5, E5, 0, D5, C5, B4, 0, A4, 0, E4, 0, A4, A4, A4, 0],
    [E5, 0, D5, C5, B4, 0, C5, D5, E5, 0, A5, 0, E5, E5, A4, 0],
  ],
  bass: [
    [A2, A2, E3, E3, A2, A2, A3, A2, A2, A2, E3, E3, A2, 0, E3, 0],
    [G2, G2, D3, D3, G2, G2, G3, G2, G2, G2, D3, D3, G2, 0, D3, 0],
    [F2, F2, C3, C3, F2, F2, F3, F2, E3, E3, B2, B2, E3, 0, B2, 0],
    [A2, A2, E3, E3, A2, A2, C3, D3, E3, E3, A2, A2, A2, A2, A2, 0],
  ],
  harmony: [
    [C5, 0, 0, 0, E5, 0, 0, 0, C5, 0, 0, 0, A4, 0, 0, 0],
    [B4, 0, 0, 0, D5, 0, 0, 0, B4, 0, 0, 0, G4, 0, 0, 0],
    [C5, 0, 0, 0, A4, 0, 0, 0, B4, 0, 0, 0, E4, 0, 0, 0],
    [E5, 0, 0, 0, C5, 0, 0, 0, A4, 0, 0, 0, E4, 0, 0, 0],
  ],
};

/** Reseña — G major fanfare. */
const RESULTS_SONG: Song = {
  bpm: 104,
  drums: "march",
  lead: [
    [G4, B4, D5, G5, G5, 0, D5, 0, E5, D5, C5, B4, G4, G4, D5, 0],
    [A4, A4, B4, C5, D5, D5, D5, 0, B4, B4, G4, A4, B4, B4, B4, 0],
    [D5, D5, G5, G5, A5, 0, G5, 0, E5, E5, D5, C5, B4, B4, G4, 0],
    [G5, D5, B4, G4, A4, A4, B4, D5, G5, G5, G5, G5, 0, 0, 0, 0],
  ],
  bass: [
    [G2, G2, D3, D3, G2, G2, G3, G2, C3, C3, G2, G2, D3, D3, D3, 0],
    [A2, A2, E3, E3, A2, A2, A2, 0, G2, G2, D3, D3, G2, G2, G2, 0],
    [C3, C3, G2, G2, C3, C3, E3, 0, G2, G2, D3, D3, G3, G3, G2, 0],
    [G2, G2, D3, D3, G3, G3, D3, D3, G2, G2, D3, D3, G2, G2, G2, 0],
  ],
  harmony: [
    [D5, 0, 0, 0, B4, 0, 0, 0, G4, 0, 0, 0, D4, 0, 0, 0],
    [C5, 0, 0, 0, A4, 0, 0, 0, B4, 0, 0, 0, G4, 0, 0, 0],
    [G5, 0, 0, 0, D5, 0, 0, 0, C5, 0, 0, 0, B4, 0, 0, 0],
    [D5, 0, 0, 0, B4, 0, 0, 0, G5, 0, 0, 0, D5, 0, 0, 0],
  ],
};

const COUNT_SONG: Song = {
  bpm: 132,
  drums: "soft",
  lead: [[C4, C4, D4, D4, E4, E4, G4, G4, A4, A4, C5, C5, E5, E5, E5, 0]],
  bass: [[C3, C3, C3, C3, G2, G2, G2, G2, C3, C3, E3, E3, G3, G3, C3, 0]],
  harmony: [[E4, 0, 0, 0, G4, 0, 0, 0, C5, 0, 0, 0, G4, 0, 0, 0]],
};

function songFor(bed: MusicBed): Song {
  if (bed === "play") return PLAY_SONG;
  if (bed === "results") return RESULTS_SONG;
  if (bed === "count") return COUNT_SONG;
  return MENU_SONG;
}

function startMusic(ctx: AudioContext, bed: MusicBed): Stop {
  const master = ctx.createGain();
  const bus = ctx.createGain();
  const limit = ctx.createDynamicsCompressor();
  limit.threshold.value = -18;
  limit.knee.value = 18;
  limit.ratio.value = 6;
  limit.attack.value = 0.006;
  limit.release.value = 0.16;
  bus.gain.value = 0.55;
  bus.connect(limit).connect(master).connect(ctx.destination);
  master.gain.value = 0.0001;

  const target =
    bed === "results" ? 0.12 : bed === "play" ? 0.1 : bed === "count" ? 0.07 : 0.08;
  master.gain.exponentialRampToValueAtTime(target, ctx.currentTime + 0.35);

  const song = songFor(bed);
  const bpm = bed === "brief" || bed === "sync" ? Math.round(song.bpm * 0.92) : song.bpm;
  const stepDur = 60 / bpm / 4;
  const drums = bed === "brief" || bed === "sync" ? "none" : song.drums;
  let step = 0;
  let next = ctx.currentTime + 0.05;
  let timer = 0;

  const tick = () => {
    const horizon = ctx.currentTime + 0.2;
    while (next < horizon) {
      const bar = Math.floor(step / 16) % song.lead.length;
      const i = step % 16;
      const melody = song.lead[bar] ?? song.lead[0];
      const bassRow = song.bass[bar] ?? song.bass[0];
      const harmRow = song.harmony[bar] ?? song.harmony[0];
      const hold = onset(melody, i);
      if (hold > 0) {
        lead(
          ctx,
          bus,
          melody[i] ?? 0,
          next,
          hold * stepDur * 0.94,
          bed === "results" ? 0.09 : bed === "play" ? 0.08 : 0.07,
        );
      }
      const bassHold = onset(bassRow, i);
      if (bassHold > 0) {
        voice(
          ctx,
          bus,
          "triangle",
          bassRow[i] ?? C3,
          next,
          bassHold * stepDur * 0.9,
          0.045,
        );
      }
      const harm = harmRow[i] ?? 0;
      if (harm > 0) {
        voice(ctx, bus, "sine", harm, next, stepDur * 3.4, 0.028);
        voice(ctx, bus, "sine", harm * 0.5, next, stepDur * 3.4, 0.014);
      }
      if (drums === "full") {
        if (i === 0 || i === 8) kick(ctx, bus, next, 0.07);
        if (i === 4 || i === 12) snare(ctx, bus, next, 0.04);
        if (i % 2 === 0) hat(ctx, bus, next, i % 4 === 0 ? 0.014 : 0.009);
      } else if (drums === "march") {
        if (i === 0 || i === 8) kick(ctx, bus, next, 0.075);
        if (i === 4 || i === 12) snare(ctx, bus, next, 0.05);
        if (i === 6 || i === 14) hat(ctx, bus, next, 0.012);
      } else if (drums === "soft") {
        if (i === 0) kick(ctx, bus, next, 0.045);
        if (i === 8) hat(ctx, bus, next, 0.012);
      }
      step += 1;
      next += stepDur;
    }
    timer = window.setTimeout(tick, 35);
  };
  tick();

  return () => {
    window.clearTimeout(timer);
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    window.setTimeout(() => {
      try {
        master.disconnect();
      } catch {
        /* already gone */
      }
    }, 220);
  };
}

function startRoom(ctx: AudioContext, level: number): { stop: Stop; master: GainNode } {
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  master.gain.exponentialRampToValueAtTime(0.016 * level, ctx.currentTime + 0.6);

  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  src.buffer = noiseBuffer(ctx, 4);
  src.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = 280;
  src.connect(filter).connect(master);
  src.start();

  let timer = 0;
  const chatter = () => {
    timer = window.setTimeout(() => {
      const now = ctx.currentTime;
      if (Math.random() < 0.45) {
        voice(ctx, master, "sine", 1240 + Math.random() * 280, now, 0.06, 0.018);
      }
      chatter();
    }, 5000 + Math.random() * 7000);
  };
  chatter();

  return {
    master,
    stop: () => {
      window.clearTimeout(timer);
      try {
        src.stop();
      } catch {
        /* already gone */
      }
      master.disconnect();
    },
  };
}

function startWork(ctx: AudioContext, id: NonNullable<WorkLoop>): Stop {
  const master = ctx.createGain();
  master.gain.value = 0.0001;
  master.connect(ctx.destination);
  master.gain.exponentialRampToValueAtTime(
    id === "grind" ? 0.1 : id === "extract" ? 0.085 : 0.07,
    ctx.currentTime + 0.12,
  );

  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  src.buffer = noiseBuffer(ctx, 1.4);
  src.loop = true;
  filter.type = id === "grind" ? "lowpass" : "bandpass";
  filter.frequency.value =
    id === "grind" ? 220 : id === "extract" ? 1100 : id === "foam" ? 2800 : 900;
  filter.Q.value = id === "grind" ? 0.6 : 1.1;
  src.connect(filter).connect(master);
  src.start();

  let pulse = 0;
  const beat = () => {
    const now = ctx.currentTime;
    if (id === "grind") {
      voice(ctx, master, "square", 90 + Math.random() * 18, now, 0.05, 0.05);
      voice(ctx, master, "triangle", 240, now, 0.04, 0.03);
      pulse = window.setTimeout(beat, 95);
    } else if (id === "extract") {
      hiss(ctx, master, now, 0.18, 0.04, 1800);
      voice(ctx, master, "sine", 160, now, 0.12, 0.03);
      pulse = window.setTimeout(beat, 220);
    } else if (id === "foam") {
      hiss(ctx, master, now, 0.16, 0.045, 3200);
      pulse = window.setTimeout(beat, 140);
    } else {
      voice(ctx, master, "sine", 520 + Math.random() * 80, now, 0.06, 0.028);
      hiss(ctx, master, now, 0.12, 0.025, 1400);
      pulse = window.setTimeout(beat, 160);
    }
  };
  beat();

  return () => {
    window.clearTimeout(pulse);
    try {
      src.stop();
    } catch {
      /* already gone */
    }
    master.disconnect();
  };
}

export function applyMusic(ctx: AudioContext | null, bed: MusicBed) {
  if (!ctx) return;
  if (music?.bed === bed) return;
  music?.stop();
  music = null;
  if (bed === "off") return;
  music = { bed, stop: startMusic(ctx, bed) };
}

export function applyAmbience(ctx: AudioContext | null, level: number) {
  if (!ctx) return;
  const next = Math.max(0, Math.min(1, level));
  if (next <= 0.01) {
    room?.stop();
    room = null;
    return;
  }
  if (!room) room = { level: next, ...startRoom(ctx, next) };
  else {
    room.level = next;
    room.master.gain.cancelScheduledValues(ctx.currentTime);
    room.master.gain.exponentialRampToValueAtTime(
      0.016 * next,
      ctx.currentTime + 0.4,
    );
  }
}

export function applyWork(ctx: AudioContext | null, id: WorkLoop) {
  if (!ctx) return;
  if ((work?.id ?? null) === id) return;
  work?.stop();
  work = null;
  if (!id) return;
  work = { id, stop: startWork(ctx, id) };
}
