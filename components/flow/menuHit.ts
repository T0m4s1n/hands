export type MenuHitBox = {
  i: number;
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** Extra pad on the sticky row so a 4px twitch does not change café. */
export const MENU_STICKY_PAD = 22;

/**
 * Which carta row the tip is on. Once a name is focused, leave it only
 * when the tip is clearly on another row or well outside this one.
 */
export function hitMenuOption(
  x: number,
  y: number,
  boxes: readonly MenuHitBox[],
  sticky = -1,
  pad = MENU_STICKY_PAD,
): number {
  if (sticky >= 0) {
    const current = boxes.find((box) => box.i === sticky);
    if (
      current &&
      x >= current.left - pad &&
      x <= current.right + pad &&
      y >= current.top - pad &&
      y <= current.bottom + pad
    ) {
      for (const other of boxes) {
        if (other.i === sticky) continue;
        const onOther =
          x >= other.left &&
          x <= other.right &&
          y >= other.top &&
          y <= other.bottom;
        const onCore =
          x >= current.left &&
          x <= current.right &&
          y >= current.top &&
          y <= current.bottom;
        if (onOther && !onCore) return other.i;
      }
      return sticky;
    }
  }

  for (const box of boxes) {
    if (x >= box.left && x <= box.right && y >= box.top && y <= box.bottom) {
      return box.i;
    }
  }
  return -1;
}
