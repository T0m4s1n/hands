export type SettlementFields = {
  lifecycle: "active" | "settling";
  pendingMark: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Starts exactly one settle animation, even if two release events race. */
export function requestSettlement(
  state: SettlementFields,
  mark: number,
): boolean {
  if (state.lifecycle !== "active") return false;
  state.lifecycle = "settling";
  state.pendingMark = clamp01(mark);
  return true;
}

/** Consumes the pending score once; subsequent calls are harmless. */
export function finishSettlement(state: SettlementFields): number | null {
  if (state.lifecycle !== "settling") return null;
  state.lifecycle = "active";
  return state.pendingMark;
}
