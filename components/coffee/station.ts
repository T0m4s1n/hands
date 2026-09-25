import type { PropKind, StageKind } from "./recipes.ts";

/**
 * The real place a barista move happens — the bowl, plate, grouphead or
 * cup mouth — not a generic scoring circle.
 */
export type Station = {
  /** Inside here the coffee move is done. Centre is not more correct. */
  well: number;
  /** Still over the object. Outside this, the move has not happened. */
  mouth: number;
};

const STATIONS: Record<PropKind, Station> = {
  grinder: { well: 1.05, mouth: 1.42 },
  saucer: { well: 0.8, mouth: 1.18 },
  brewer: { well: 0.58, mouth: 0.98 },
  portafilter: { well: 0.54, mouth: 0.86 },
  mug: { well: 0.44, mouth: 0.78 },
  cup: { well: 0.42, mouth: 0.74 },
  machine: { well: 0.9, mouth: 1.28 },
  kettle: { well: 0.55, mouth: 0.9 },
  jug: { well: 0.28, mouth: 0.5 },
  filter: { well: 0.55, mouth: 0.88 },
  scoop: { well: 0.35, mouth: 0.7 },
  crank: { well: 1.0, mouth: 1.2 },
  tamper: { well: 0.4, mouth: 0.7 },
  mat: { well: 2.6, mouth: 3.2 },
};

export function stationOf(sits: PropKind): Station {
  return STATIONS[sits] ?? { well: 1.1, mouth: 1.4 };
}

export function stageStation(kind: StageKind, sits: PropKind): Station {
  if (kind === "crank") return { well: 1.0, mouth: 1.2 };
  if (kind === "shake") return STATIONS.mat;
  const base = stationOf(sits);
  if (kind === "hold" || kind === "tilt") {
    // Liquid should flow when the jug/kettle is over the vessel, not when
    // it kisses a painted bullseye. Keep the well for the cue; open the mouth.
    return { well: base.well, mouth: Math.max(base.mouth, 1.18) };
  }
  if (kind === "tamp") {
    return { well: 0.54, mouth: 0.98 };
  }
  return base;
}

export function overStation(distance: number, station: Station): boolean {
  return distance <= station.mouth;
}

/**
 * A successful place is "on the object", not "on the bullseye".
 * The well is full marks; the rim is still a good coffee.
 */
export function stationQuality(distance: number, station: Station): number {
  if (distance <= station.well) return 1;
  if (distance >= station.mouth) return 0;
  const t = (distance - station.well) / Math.max(station.mouth - station.well, 1e-4);
  return 0.8 + 0.2 * (1 - t);
}
