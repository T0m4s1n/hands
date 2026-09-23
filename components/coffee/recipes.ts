/**
 * What the player makes, and how well they made it.
 *
 * A stage is never failed into a repeat — it always ends and always leaves a
 * mark between 0 and 1. That is the whole scoring idea: a clumsy pour still
 * pours, it just makes a worse coffee, and the grade at the end is the sum of
 * everything you did well or badly on the way.
 */

import type { LiquidKind } from "./liquid";

/** Each gesture the hands can be asked for. */
export type StageKind =
  /** Pinch it up, carry it, let go inside the ring. Scored on where it lands. */
  | "place"
  /** Take the handle and turn it in circles. Scored on how far you turned. */
  | "crank"
  /** Keep it over the ring while something fills. Scored on the level. */
  | "hold"
  /** Press straight down onto the target. Scored on how evenly you pressed. */
  | "tamp"
  /** Grip and shake. Scored on how many times you reversed direction. */
  | "shake"
  /** Hold it over the ring and roll your wrist to tip it. Scored on the pour. */
  | "tilt";

export type PropKind =
  | "scoop"
  | "crank"
  | "grinder"
  | "filter"
  | "brewer"
  | "kettle"
  | "cup"
  | "mug"
  | "saucer"
  | "portafilter"
  | "tamper"
  | "jug"
  | "machine"
  | "mat";

export type Stage = {
  id: string;
  title: string;
  instruction: string;
  kind: StageKind;
  /** Where the held object starts, in tabletop coordinates. */
  item: readonly [number, number];
  /** Where it has to go, or the pivot for a crank. */
  target: readonly [number, number];
  /** How near counts as inside the ring. */
  radius: number;
  /**
   * The amount to aim for, in whatever the gesture is measured in: radians
   * turned for a crank, presses for a tamp, strokes for a shake, a level from 0
   * to 1 for a hold or a pour. Always the same unit as `band`.
   */
  goal: number;
  /**
   * The window that scores full marks. Outside it the mark falls away. Left
   * out, the stage is scored on where the object landed instead of on how much
   * of something the player produced.
   */
  band?: readonly [number, number];
  /** For a hold or a pour: how much of the level fills in a second. */
  rate?: number;
  /** What the player holds, and what they are aiming at. */
  holds: PropKind;
  sits: PropKind;
  /** Where the liquid collects, when that is not the target itself. */
  vessel?: PropKind;
  /** What is being poured. Coffee unless said otherwise. */
  liquid?: LiquidKind;
};

export type Recipe = {
  id: string;
  name: string;
  blurb: string;
  /** Roast colour for the cup and the menu card. */
  colour: string;
  stages: readonly Stage[];
};

const GRINDER: readonly [number, number] = [1.85, 0.1];
const STATION: readonly [number, number] = [0, 0.1];
const RIGHT_REST: readonly [number, number] = [1.9, 0.1];
const LEFT_REST: readonly [number, number] = [-2.15, -0.2];

/**
 * A black filter coffee. The gentle one: carry, grind, pour, serve, with the
 * pour asking for a steady wrist rather than speed.
 */
const TINTO: Recipe = {
  id: "tinto",
  name: "Tinto",
  blurb: "Filtrado, suave. Buen sitio para empezar.",
  colour: "#4a2a16",
  stages: [
    {
      id: "dose",
      title: "Dosifica",
      instruction: "Pellizca la cuchara con granos y suéltala sobre el molino.",
      kind: "place",
      item: LEFT_REST,
      target: GRINDER,
      radius: 1.02,
      goal: 0,
      holds: "scoop",
      sits: "grinder",
    },
    {
      id: "grind",
      title: "Muele",
      instruction: "Toma la manivela y gírala siguiendo el círculo.",
      kind: "crank",
      item: [1.05, 0],
      target: [0, 0],
      radius: 1.05,
      goal: Math.PI * 4,
      band: [Math.PI * 3, Math.PI * 5],
      holds: "crank",
      sits: "grinder",
    },
    {
      id: "filter",
      title: "Filtro",
      instruction: "Lleva el filtro con el molido hasta la cafetera.",
      kind: "place",
      item: LEFT_REST,
      target: RIGHT_REST,
      radius: 1.02,
      goal: 0,
      holds: "filter",
      sits: "brewer",
    },
    {
      id: "pour",
      title: "Vierte",
      instruction: "Sostén la tetera sobre el filtro y gira la muñeca para verter.",
      kind: "tilt",
      item: [-2.3, -0.9],
      target: STATION,
      radius: 1.0,
      goal: 0.8,
      band: [0.7, 0.9],
      rate: 0.45,
      holds: "kettle",
      sits: "brewer",
    },
    {
      id: "serve",
      title: "Sirve",
      instruction: "Lleva la taza servida hasta el plato.",
      kind: "place",
      item: [-1.95, -0.1],
      target: RIGHT_REST,
      radius: 1.05,
      goal: 0,
      holds: "cup",
      sits: "saucer",
    },
  ],
};

/**
 * Espresso. The precise one: the tamp and the extraction both want a measured
 * amount rather than a big movement.
 */
const ESPRESSO: Recipe = {
  id: "espresso",
  name: "Espresso",
  blurb: "Corto e intenso. Pide pulso en el prensado.",
  colour: "#2d1608",
  stages: [
    {
      id: "dose",
      title: "Dosifica",
      instruction: "Pellizca la cuchara y llena el portafiltro.",
      kind: "place",
      item: LEFT_REST,
      target: STATION,
      radius: 1.0,
      goal: 0,
      holds: "scoop",
      sits: "portafilter",
    },
    {
      id: "grind",
      title: "Muele fino",
      instruction: "Gira la manivela: el espresso pide molido más fino.",
      kind: "crank",
      item: [1.05, 0],
      target: [0, 0],
      radius: 1.05,
      goal: Math.PI * 6,
      band: [Math.PI * 5, Math.PI * 7],
      holds: "crank",
      sits: "grinder",
    },
    {
      id: "tamp",
      title: "Prensa",
      instruction: "Toma el prensador y baja la mano sobre el portafiltro.",
      kind: "tamp",
      item: [-2.1, -0.9],
      target: STATION,
      radius: 0.95,
      goal: 3,
      band: [2, 4],
      holds: "tamper",
      sits: "portafilter",
    },
    {
      id: "extract",
      title: "Extrae",
      instruction: "Sostén el portafiltro en la máquina hasta llenar la franja.",
      kind: "hold",
      item: [-2.1, -0.2],
      target: STATION,
      radius: 1.0,
      goal: 0.68,
      band: [0.55, 0.8],
      rate: 0.38,
      liquid: "espresso",
      holds: "portafilter",
      sits: "machine",
      vessel: "mug",
    },
    {
      id: "serve",
      title: "Sirve",
      instruction: "Lleva la taza hasta el plato.",
      kind: "place",
      item: [-1.95, -0.1],
      target: RIGHT_REST,
      radius: 1.05,
      goal: 0,
      holds: "cup",
      sits: "saucer",
    },
  ],
};

/**
 * Cappuccino. The busy one: the milk has to be frothed and then poured, so it
 * asks for two quite different movements back to back.
 */
const CAPUCHINO: Recipe = {
  id: "capuchino",
  name: "Capuchino",
  blurb: "Con leche espumada. El más movido de los tres.",
  colour: "#6b4326",
  stages: [
    {
      id: "grind",
      title: "Muele",
      instruction: "Gira la manivela para moler la base.",
      kind: "crank",
      item: [1.05, 0],
      target: [0, 0],
      radius: 1.05,
      goal: Math.PI * 5,
      band: [Math.PI * 4, Math.PI * 6],
      holds: "crank",
      sits: "grinder",
    },
    {
      id: "extract",
      title: "Extrae",
      instruction: "Sostén el portafiltro en la máquina hasta llenar la franja.",
      kind: "hold",
      item: [-2.1, -0.2],
      target: STATION,
      radius: 1.0,
      goal: 0.58,
      band: [0.45, 0.7],
      rate: 0.42,
      liquid: "espresso",
      holds: "portafilter",
      sits: "machine",
      vessel: "mug",
    },
    {
      id: "froth",
      title: "Espuma",
      instruction: "Toma la jarra de leche y agítala de lado a lado.",
      kind: "shake",
      item: [-2.2, -0.9],
      target: [-2.2, -0.9],
      radius: 1.1,
      goal: 10,
      band: [8, 14],
      holds: "jug",
      sits: "mat",
    },
    {
      id: "milk",
      title: "Vierte la leche",
      instruction: "Sostén la jarra sobre la taza y gira la muñeca.",
      kind: "tilt",
      item: [-2.2, -0.9],
      target: STATION,
      radius: 1.0,
      goal: 0.6,
      band: [0.5, 0.75],
      rate: 0.5,
      holds: "jug",
      sits: "mug",
      liquid: "milk",
    },
    {
      id: "serve",
      title: "Sirve",
      instruction: "Lleva la taza hasta el plato.",
      kind: "place",
      item: [-1.95, -0.1],
      target: RIGHT_REST,
      radius: 1.05,
      goal: 0,
      holds: "cup",
      sits: "saucer",
    },
  ],
};

export const RECIPES: readonly Recipe[] = [TINTO, ESPRESSO, CAPUCHINO];

/** Full marks inside the band, falling away over the same width outside it. */
export function bandScore(
  value: number,
  band: readonly [number, number],
): number {
  const [low, high] = band;
  if (value >= low && value <= high) return 1;
  const fade = Math.max((high - low) * 0.9, 1e-4);
  const miss = value < low ? low - value : value - high;
  return Math.max(0, 1 - miss / fade);
}

/** Full marks dead centre, nothing at all by the time you reach the rim. */
export function placeScore(distance: number, radius: number): number {
  return Math.max(0, 1 - distance / Math.max(radius, 1e-4));
}

export function grade(score: number): string {
  if (score >= 0.9) return "Excelente";
  if (score >= 0.75) return "Muy bueno";
  if (score >= 0.6) return "Correcto";
  if (score >= 0.4) return "Mejorable";
  return "Para tirar";
}
