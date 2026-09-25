/**
 * What the landmarker actually sees.
 *
 * A 1080p selfie in a dim room is the worst input the palm detector can get:
 * the hand is a handful of dark pixels and the tracker latches onto a box
 * that no longer contains a hand. We shrink to a working size (coordinates
 * stay normalised), lift the exposure when the frame is dark, and only then
 * run inference.
 */

/** Working size for inference. 640 is enough for the bones and cheap to run. */
export const DETECT_MAX_EDGE = 640;

/** Cached CSS filter while we re-sample luma every few hundred milliseconds. */
export type LightingState = {
  filter: string;
  nextSampleAt: number;
  mean: number;
};

export function lightingFilter(meanLuma: number): string {
  if (meanLuma >= 118) return "contrast(1.1)";
  if (meanLuma >= 80) return "brightness(1.22) contrast(1.16)";
  if (meanLuma >= 50) return "brightness(1.42) contrast(1.22)";
  return "brightness(1.68) contrast(1.3)";
}

export function meanLuma(
  pixels: ArrayLike<number>,
  stride = 4,
): number {
  const step = stride * 4;
  if (pixels.length < 4) return 128;
  let sum = 0;
  let n = 0;
  for (let i = 0; i + 2 < pixels.length; i += step) {
    sum += pixels[i] * 0.2126 + pixels[i + 1] * 0.7152 + pixels[i + 2] * 0.0722;
    n += 1;
  }
  return n === 0 ? 128 : sum / n;
}

export function detectSize(
  width: number,
  height: number,
  maxEdge = DETECT_MAX_EDGE,
): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (edge <= maxEdge || edge <= 0) return { width, height };
  const scale = maxEdge / edge;
  return {
    width: Math.max(2, Math.round(width * scale)),
    height: Math.max(2, Math.round(height * scale)),
  };
}

export type DetectFrame = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
  probe: HTMLCanvasElement;
  probeCtx: CanvasRenderingContext2D | null;
  lighting: LightingState;
};

function makeFrame(): DetectFrame {
  const canvas = document.createElement("canvas");
  const probe = document.createElement("canvas");
  probe.width = 80;
  probe.height = 45;
  return {
    canvas,
    ctx: canvas.getContext("2d", { alpha: false, desynchronized: true }),
    probe,
    probeCtx: probe.getContext("2d", { willReadFrequently: true }),
    lighting: { filter: "contrast(1.06)", nextSampleAt: 0, mean: 128 },
  };
}

function sampleFilter(
  frame: DetectFrame,
  now: number,
): string {
  if (now < frame.lighting.nextSampleAt) return frame.lighting.filter;
  const { probe, probeCtx, canvas } = frame;
  if (!probeCtx || !canvas.width) return frame.lighting.filter;
  probeCtx.drawImage(canvas, 0, 0, probe.width, probe.height);
  const pixels = probeCtx.getImageData(0, 0, probe.width, probe.height).data;
  const mean = meanLuma(pixels, 2);
  // Ignore small luma swings — flipping the lift every beat makes landmarks tremble.
  if (Math.abs(mean - frame.lighting.mean) >= 10) {
    frame.lighting.filter = lightingFilter(mean);
    frame.lighting.mean = mean;
  }
  frame.lighting.nextSampleAt = now + 400;
  return frame.lighting.filter;
}

/**
 * Mirror, size and expose the camera frame for the landmarker.
 * Falls back to the raw video if a 2D context is missing.
 */
export function prepareDetectFrame(
  ref: { current: DetectFrame | null },
  video: HTMLVideoElement,
  width: number,
  height: number,
  now = 0,
): HTMLVideoElement | HTMLCanvasElement {
  if (!width || !height) return video;
  let frame = ref.current;
  if (!frame) {
    frame = makeFrame();
    ref.current = frame;
  }
  const { canvas, ctx } = frame;
  if (!ctx) return video;

  const size = detectSize(width, height);
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  }

  ctx.setTransform(-1, 0, 0, 1, size.width, 0);
  ctx.filter = "none";
  ctx.drawImage(video, 0, 0, size.width, size.height);

  const filter = sampleFilter(frame, now);
  // Skip the second pass unless the room is actually dark — contrast-only
  // is a full extra upload for almost no landmark gain.
  if (filter.includes("brightness")) {
    ctx.filter = filter;
    ctx.drawImage(video, 0, 0, size.width, size.height);
    ctx.filter = "none";
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return canvas;
}
