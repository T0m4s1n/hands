/** How long a silent permission prompt may hang before we offer a retry. */
export const CAMERA_HANG_MS = 2000;

/**
 * Which gate buttons to show. The mouse path must stay available while
 * getUserMedia is pending — a hung permission dialog used to trap the
 * screen on "Pidiendo la cámara…" with no way out (and React Strict Mode
 * cancelled the hang timer on remount).
 */
export function cameraGateButtons(state: {
  asking: boolean;
  loading: boolean;
  waiting: boolean;
}): { showMouse: boolean; showRetry: boolean } {
  if (state.loading) {
    return { showMouse: false, showRetry: false };
  }
  return {
    showMouse: true,
    showRetry: !state.asking && !state.waiting,
  };
}
