export type AppPhase =
  | "sync"
  | "menu"
  | "brief"
  | "count"
  | "play"
  | "results";

export type PhasePolicy = {
  showHands: boolean;
  acceptGameplayInput: boolean;
  showGameplayGuides: boolean;
};

/**
 * One owner for cross-screen visibility and input. The WebGL scene remains
 * mounted throughout; phases only change its policy, so hands and props never
 * need to be destroyed and recreated during an iris transition.
 */
export function phasePolicy(phase: AppPhase): PhasePolicy {
  switch (phase) {
    case "sync":
    case "menu":
      return {
        // These phases own clean 2D teaching/reticle feedback. Showing the
        // tracked 3D glove underneath created duplicate, malformed-looking
        // hands without adding interaction information.
        showHands: false,
        acceptGameplayInput: false,
        showGameplayGuides: false,
      };
    case "play":
      return {
        showHands: true,
        acceptGameplayInput: true,
        showGameplayGuides: true,
      };
    case "brief":
    case "count":
    case "results":
      return {
        showHands: false,
        acceptGameplayInput: false,
        showGameplayGuides: false,
      };
  }
}

/** Which cafe bed plays behind a phase. `off` is never used — even sync hums. */
export function musicForPhase(
  phase: AppPhase,
): "sync" | "menu" | "brief" | "count" | "play" | "results" {
  switch (phase) {
    case "sync":
    case "menu":
    case "brief":
    case "count":
    case "play":
    case "results":
      return phase;
  }
}

/** Menu, play and results are three different songs — key, tempo, groove. */
export function musicTheme(phase: AppPhase): {
  key: string;
  bpm: number;
  groove: string;
} {
  switch (phase) {
    case "play":
      return { key: "Am", bpm: 128, groove: "full" };
    case "results":
      return { key: "G", bpm: 104, groove: "march" };
    case "count":
      return { key: "C", bpm: 132, groove: "soft" };
    case "menu":
    case "brief":
    case "sync":
      return { key: "C", bpm: 90, groove: "soft" };
  }
}

/** Room tone stays under the song. Play is a little busier; countdown is hush. */
export function ambienceForPhase(phase: AppPhase): number {
  switch (phase) {
    case "play":
      return 0.22;
    case "menu":
    case "brief":
    case "results":
      return 0.12;
    case "sync":
      return 0.1;
    case "count":
      return 0.06;
  }
}
