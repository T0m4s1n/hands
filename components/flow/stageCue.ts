import type { PropKind, StageKind } from "../coffee/recipes.ts";
import { stagePrompt } from "./playCopy.ts";

export function stageCue({
  kind,
  sits,
  near,
  holding,
  working,
  pointer,
}: {
  kind: StageKind | undefined;
  sits?: PropKind;
  near: boolean;
  holding: boolean;
  working: boolean;
  pointer: boolean;
}): string {
  return stagePrompt({ kind, sits, near, holding, working, pointer });
}
