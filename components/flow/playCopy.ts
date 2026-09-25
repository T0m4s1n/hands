import type { PropKind, StageKind } from "@/components/coffee/recipes";

/**
 * One vocabulary for menu, briefing, HUD and results.
 *
 * Halo = the tool you pick up. Destination = the station you work over.
 * Franja = the fill/press/shake window. Círculo = only the grinder crank.
 */

export const DESTINATION: Record<PropKind, string> = {
  grinder: "el molino",
  saucer: "el plato",
  brewer: "la cafetera",
  portafilter: "el portafiltro",
  mug: "la taza",
  cup: "la taza",
  machine: "la máquina",
  kettle: "la tetera",
  jug: "la jarra",
  filter: "el filtro",
  scoop: "la cuchara",
  crank: "la manivela",
  tamper: "el prensador",
  mat: "la barra",
};

export const KIND_VERB: Record<StageKind, string> = {
  place: "Lleva",
  crank: "Gira",
  hold: "Extrae",
  tamp: "Prensa",
  shake: "Agita",
  tilt: "Vierte",
};

export function destinationOf(sits: PropKind): string {
  return DESTINATION[sits] ?? "el destino";
}

export function markColour(mark: number): string {
  const safe = Math.max(0, Math.min(1, mark));
  return `hsl(${8 + safe * 38} ${85 - safe * 16}% ${42 + safe * 18}%)`;
}

export function stagePrompt({
  kind,
  sits,
  near,
  holding,
  working,
  hurry,
  pointer,
}: {
  kind: StageKind | undefined;
  sits?: PropKind;
  near: boolean;
  holding: boolean;
  working: boolean;
  hurry?: boolean;
  pointer: boolean;
}): string {
  if (hurry) return "Se acaba el tiempo — se cierra con lo que lleves";
  const dest = sits ? destinationOf(sits) : "el destino";

  if (!holding) {
    if (near) return pointer ? "Mantén clic para tomarlo" : "Pellizca para tomarlo";
    return "Toma el utensilio que brilla";
  }

  if (working) {
    if (kind === "crank") return "Sigue girando alrededor del molino";
    if (kind === "shake") return "Sigue agitando de lado a lado";
    if (kind === "tamp") return `Sigue prensando sobre ${dest}`;
    if (kind === "hold") return "El espresso cae a la taza — suelta en la franja";
    if (kind === "tilt") {
      return sits === "mug"
        ? "Zigzaguea y cierra con un corazón"
        : sits === "brewer"
          ? "Vierte sobre el gotero y detente en la franja"
          : "Mira el nivel y detente en la franja";
    }
  }

  switch (kind) {
    case "place":
      if (sits === "brewer") {
        return pointer
          ? "Mantén clic, llévalo al gotero y suelta el molido"
          : "Suelta el molido sobre el gotero";
      }
      return pointer
        ? `Mantén clic, llévalo encima de ${dest} y suelta`
        : `Suelta cuando esté encima de ${dest}`;
    case "tilt":
      if (sits === "mug") {
        return pointer
          ? "Mantén clic sobre la taza, usa la rueda y zigzaguea un corazón"
          : "Inclina sobre la taza, zigzaguea como un barista y cierra con un corazón";
      }
      return pointer
        ? `Mantén clic sobre ${dest} y usa la rueda para inclinar`
        : `Inclina la muñeca sobre ${dest}`;
    case "hold":
      return pointer
        ? "Mantén clic con el portafiltro encajado — el café cae solo"
        : "Encaja el portafiltro bajo el grupo y espera el hilo de café";
    case "crank":
      return pointer
        ? "Mantén clic y dibuja círculos alrededor del molino"
        : "Gira la manivela alrededor del molino";
    case "shake":
      return pointer
        ? "Mantén clic y agita de lado a lado"
        : "Agítalo de lado a lado";
    case "tamp":
      return pointer
        ? `Mantén clic y prensa sobre ${dest}`
        : `Prensa sobre ${dest}`;
    default:
      return `Trabaja sobre ${dest}`;
  }
}

export function stageSummary(kind: StageKind, sits: PropKind): string {
  const dest = destinationOf(sits);
  switch (kind) {
    case "place":
      return sits === "brewer"
        ? "Vaciar el molido en el gotero"
        : `Dejarlo sobre ${dest}`;
    case "crank":
      return "Girar alrededor del molino";
    case "hold":
      return sits === "machine"
        ? "Encajar y extraer el espresso"
        : `Llenar la franja en ${dest}`;
    case "tilt":
      return sits === "mug"
        ? "Verter la leche en un corazón"
        : sits === "brewer"
          ? "Verter sobre el gotero hasta la franja"
          : `Verter sobre ${dest} hasta la franja`;
    case "tamp":
      return `Prensar sobre ${dest}`;
    case "shake":
      return "Agitar de lado a lado";
  }
}
