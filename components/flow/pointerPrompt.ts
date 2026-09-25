import type { PropKind, StageKind } from "../coffee/recipes.ts";
import { stagePrompt } from "./playCopy.ts";

export function pointerStagePrompt(
  kind: StageKind | undefined,
  sits?: PropKind,
): string {
  return stagePrompt({
    kind,
    sits,
    near: true,
    holding: true,
    working: false,
    pointer: true,
  });
}
