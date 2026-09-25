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
  /** Carry it onto the destination. Scored if it lands on that object. */
  | "place"
  /** Turn the handle around the grinder. Scored on how far you turned. */
  | "crank"
  /** Keep it on the station while something fills. Scored on the level. */
  | "hold"
  /** Press down on the basket. Scored on how evenly you pressed. */
  | "tamp"
  /** Grip and shake. Scored on how many times you reversed direction. */
  | "shake"
  /** Tip it over the vessel. Scored on the pour, not on a painted ring. */
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
  /** Visual hint size. Scoring uses the destination's real station. */
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
  /**
   * Extra gesture on a pour. A heart is the classic barista finish: zigzag
   * the jug while the milk flows, then cut through the middle.
   */
  flourish?: "heart";
};

export type Recipe = {
  id: string;
  name: string;
  blurb: string;
  /** Two sentences for the menu preview, longer than the blurb. */
  pitch: string;
  /** Roast colour for the cup and the menu card. */
  colour: string;
  stages: readonly Stage[];
};

/** Cut-out photograph for the homepage panels. */
export function recipePortrait(id: string): string {
  return `/cafes/${id}.png`;
}

/** Full scene used by the in-game carta, not a cut-out. */
export function recipeHero(id: string): string {
  return `/cafes/${id}-hero.jpg`;
}

/**
 * How a mark reads as stars. Five is the band you were asked for; zero is
 * a stage that never started. The steps match `grade()`, so a "Muy bueno"
 * is four stars and not a surprise.
 */
export function stars(mark: number): number {
  if (mark >= 0.9) return 5;
  if (mark >= 0.75) return 4;
  if (mark >= 0.6) return 3;
  if (mark >= 0.4) return 2;
  if (mark > 0) return 1;
  return 0;
}

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
  pitch:
    "Un filtrado de casa. Mueles, vacías el molido en el gotero, viertes con pulso y sirves. El más calmo de los tres: un mal vertido se nota, y no se repite.",
  colour: "#4a2a16",
  stages: [
    {
      id: "dose",
      title: "Dosifica",
      instruction: "Lleva la cuchara llena y suéltala sobre el molino.",
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
      instruction: "Gira la manivela alrededor del molino.",
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
      instruction: "Vacía el molido en el gotero de la cafetera.",
      kind: "place",
      item: LEFT_REST,
      target: STATION,
      radius: 1.02,
      goal: 0,
      holds: "filter",
      sits: "brewer",
    },
    {
      id: "pour",
      title: "Vierte",
      instruction: "Inclina la tetera sobre el gotero y llena la franja.",
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
  pitch:
    "Corto. El prensado y la extracción quieren medida, no prisa. Tres golpes bien puestos valen más que apretar fuerte.",
  colour: "#2d1608",
  stages: [
    {
      id: "dose",
      title: "Dosifica",
      instruction: "Lleva la cuchara llena y suéltala sobre el molino.",
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
      title: "Muele fino",
      instruction: "Gira la manivela alrededor del molino, más fino.",
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
      instruction: "Prensa sobre el portafiltro.",
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
      instruction:
        "Encaja el portafiltro bajo el grupo. El espresso cae solo a la taza — suelta en la franja.",
      kind: "hold",
      item: [-2.1, -0.2],
      target: STATION,
      radius: 1.05,
      goal: 0.68,
      band: [0.55, 0.8],
      rate: 0.32,
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
  pitch:
    "Leche espumada y el vertido de un barista: zigzag sobre la taza y un corazón al cerrar. Los dos gestos cuentan.",
  colour: "#6b4326",
  stages: [
    {
      id: "grind",
      title: "Muele",
      instruction: "Gira la manivela alrededor del molino.",
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
      instruction:
        "Encaja el portafiltro bajo el grupo. El espresso cae solo a la taza — suelta en la franja.",
      kind: "hold",
      item: [-2.1, -0.2],
      target: STATION,
      radius: 1.05,
      goal: 0.58,
      band: [0.45, 0.7],
      rate: 0.36,
      liquid: "espresso",
      holds: "portafilter",
      sits: "machine",
      vessel: "mug",
    },
    {
      id: "froth",
      title: "Espuma",
      instruction: "Agita la jarra de leche de lado a lado.",
      kind: "shake",
      item: [-2.2, -0.9],
      target: [-2.2, -0.9],
      radius: 1.1,
      goal: 10,
      band: [8, 14],
      holds: "jug",
      sits: "mat",
      liquid: "milk",
    },
    {
      id: "milk",
      title: "Vierte la leche",
      instruction:
        "Inclina la jarra sobre la taza, zigzaguea como un barista y cierra con un corazón.",
      kind: "tilt",
      item: [-2.2, -0.9],
      target: STATION,
      radius: 1.0,
      goal: 0.6,
      band: [0.5, 0.75],
      rate: 0.46,
      holds: "jug",
      sits: "mug",
      liquid: "milk",
      flourish: "heart",
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

/**
 * Landing on the object is the point. The inner well is full marks; the rim
 * is still a good coffee. Only missing the destination scores nothing.
 */
export function placeScore(distance: number, radius: number): number {
  const well = Math.max(radius, 1e-4) * 0.72;
  if (distance <= well) return 1;
  if (distance >= radius) return 0;
  const t = (distance - well) / Math.max(radius - well, 1e-4);
  return 0.8 + 0.2 * (1 - t);
}

export function grade(score: number): string {
  if (score >= 0.9) return "Excelente";
  if (score >= 0.75) return "Muy bueno";
  if (score >= 0.6) return "Correcto";
  if (score >= 0.4) return "Mejorable";
  return "Para tirar";
}
