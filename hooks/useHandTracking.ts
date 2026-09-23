"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { assignHands } from "./handAssignment";

export type Handedness = "Left" | "Right";

export type Vec3 = { x: number; y: number; z: number };

export type TrackedHand = {
  handedness: Handedness;
  landmarks: Vec3[];
  smoothedLandmarks: Vec3[];
  cursor: Vec3;
  pinchDistance: number;
  isGrabbing: boolean;
  /**
   * How far the wrist is rolled, in radians, when the input can say so
   * directly. Camera tracking cannot — it has to be read off the landmarks —
   * so this is left unset there and only the pointer fallback fills it in.
   */
  roll?: number;
};

export type TrackingStatus =
  | "idle"
  | "requesting-camera"
  | "loading-model"
  | "ready"
  | "denied"
  | "error";

export type GrabThresholds = {
  enter: number;
  exit: number;
};

export type HandHud = {
  handedness: Handedness;
  pinchDistance: number;
  isGrabbing: boolean;
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";
const MEDIAPIPE_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

/**
 * How hard the landmarks are smoothed, and the rule that decides.
 *
 * A fixed blend per frame is the wrong tool twice over. It smooths a hand that
 * is racing across the frame exactly as hard as one resting on the counter, so
 * fast movement arrives late — the lag people actually feel — while slow
 * movement still shimmers. And because it is per frame rather than per second,
 * the same setting behaves differently at thirty and at a hundred and twenty.
 *
 * So: smooth hard when the hand is still, barely at all when it is moving, and
 * scale by how long the frame took.
 */
const STILL_RATE = 14;
const MOVING_RATE = 90;
/** How far a landmark travels in a frame before it counts as moving. */
const MOVING_SPAN = 0.045;
const MAX_HANDS = 2;
const DROP_AFTER_MISSED_FRAMES = 8;
const HUD_INTERVAL_MS = 80;

const DEFAULT_THRESHOLDS: GrabThresholds = { enter: 0.32, exit: 0.52 };

const WORLD_X = 7;
// Landmarks are normalised separately over the frame's width and height, so the
// two axes only carry the same physical distance once the frame's shape is
// divided back out. Getting this wrong squashes the hand along one axis, which
// then reads as foreshortening and curls fingers that are in fact straight.
// Holds a 4:3 guess until the camera reports its real frame.
let worldY = WORLD_X * 0.75;

export function setFrameShape(width: number, height: number) {
  if (width > 0 && height > 0) worldY = WORLD_X * (height / width);
}


const WORLD_Z = 1.4;
/**
 * The height the hands ride above the counter.
 *
 * Fixed, on purpose. This used to be driven by how near the camera the hand
 * looked, against a range the session learned as it went — which meant the
 * hands, and everything they were holding, slowly breathed up and down with
 * nothing but tracking noise behind it. A camera pointed at a person cannot
 * measure distance; it can only measure how big they look, and inferring one
 * from the other needs a scale nobody supplies. Two steady axes the player
 * controls beat three where the third argues with them.
 */
const HAND_HOVER = 0.95;
/** How far a wrist may travel between frames and still be the same hand. */
const MATCH_RADIUS = 0.22;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

type NormalizedLandmark = { x: number; y: number; z: number };

type HandLandmarkerResult = {
  landmarks: NormalizedLandmark[][];
  handedness: { categoryName: string }[][];
};

type HandLandmarker = {
  detectForVideo: (
    frame: HTMLVideoElement | HTMLCanvasElement,
    timestamp: number,
  ) => HandLandmarkerResult;
  close: () => void;
};

type MediaPipeVision = {
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<unknown>;
  };
  HandLandmarker: {
    createFromOptions: (
      fileset: unknown,
      options: {
        baseOptions: { modelAssetPath: string; delegate: "GPU" | "CPU" };
        runningMode: "VIDEO";
        numHands: number;
        minHandDetectionConfidence: number;
        minHandPresenceConfidence: number;
        minTrackingConfidence: number;
      },
    ) => Promise<HandLandmarker>;
  };
};

async function loadMediaPipe(): Promise<MediaPipeVision> {
  const load = new Function("url", "return import(url)") as (
    url: string,
  ) => Promise<MediaPipeVision>;
  return load(MEDIAPIPE_MODULE_URL);
}

type PersistedHand = {
  smoothed: Vec3[];
  isGrabbing: boolean;
  missed: number;
};

function dist(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function toVec3(lm: NormalizedLandmark): Vec3 {
  return { x: lm.x, y: lm.y, z: lm.z };
}

function lerpVec(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

function smoothLandmarks(
  prev: Vec3[] | undefined,
  next: Vec3[],
  dt: number,
): Vec3[] {
  if (!prev || prev.length !== next.length) return next;

  // One speed for the whole hand, measured at the wrist: smoothing the fingers
  // at different rates from the palm pulls the hand apart when it moves.
  const travelled = Math.hypot(next[0].x - prev[0].x, next[0].y - prev[0].y);
  const moving = Math.min(1, travelled / MOVING_SPAN);
  const rate = STILL_RATE + (MOVING_RATE - STILL_RATE) * moving;
  // Frame-rate independent: the same rate settles in the same wall-clock time
  // whatever the frame took.
  const t = 1 - Math.exp(-rate * Math.min(dt, 0.1));

  return next.map((point, i) => lerpVec(prev[i], point, t));
}

export function landmarkToWorld(lm: Vec3): Vec3 {
  return {
    // No flip here: the frame was already mirrored before detection. Confirmed
    // against the raw landmark overlay, which lands on the correct side.
    x: (lm.x - 0.5) * WORLD_X,
    y: (0.5 - lm.y) * worldY,
    // The tracker's per-landmark depth is kept, but only for the shape of the
    // fingers — a curled finger really does sit nearer than a straight one,
    // and that is all this reading is steady enough to be trusted with. It
    // never decides how high the hand itself is.
    z: HAND_HOVER + Math.max(-0.7, Math.min(0.7, -lm.z * WORLD_Z)),
  };
}

/**
 * World-space points used to test whether a hand can reach an object. Palm
 * centre is the main contact; tips catch grabs that land on the fingers.
 * Recognition is unchanged — this is only the interaction probe.
 */
export function handGrabPoints(landmarks: Vec3[]): Vec3[] {
  if (landmarks.length < 21) return [];
  const wrist = landmarks[0];
  const indexMcp = landmarks[5];
  const middleMcp = landmarks[9];
  const pinkyMcp = landmarks[17];
  const palm = {
    x: (wrist.x + middleMcp.x) * 0.5,
    y: (wrist.y + middleMcp.y) * 0.5,
    z: (wrist.z + middleMcp.z) * 0.5,
  };
  return [palm, wrist, indexMcp, middleMcp, pinkyMcp, landmarks[4], landmarks[8]].map(
    landmarkToWorld,
  );
}

function pinchMetrics(landmarks: Vec3[]): { pinchDistance: number; cursor: Vec3 } {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const handSize = Math.max(dist(wrist, middleMcp), 1e-4);
  const pinchDistance = dist(thumbTip, indexTip) / handSize;
  // Carry/collide from the palm, not the pinch midpoint: tips jitter more and
  // drift off the visual glove once hand size is locked.
  const palm = {
    x: (wrist.x + middleMcp.x) * 0.5,
    y: (wrist.y + middleMcp.y) * 0.5,
    z: (wrist.z + middleMcp.z) * 0.5,
  };
  return { pinchDistance, cursor: landmarkToWorld(palm) };
}

function applyHysteresis(
  prevGrabbing: boolean,
  pinchDistance: number,
  thresholds: GrabThresholds,
): boolean {
  if (prevGrabbing) return pinchDistance < thresholds.exit;
  return pinchDistance < thresholds.enter;
}

type MirrorCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D | null;
};

/**
 * Flips the camera frame horizontally into a reusable canvas. Falls back to the
 * unflipped video if a 2D context is unavailable, which costs the mirror but
 * keeps tracking alive.
 */
function mirrorFrame(
  ref: { current: MirrorCanvas | null },
  video: HTMLVideoElement,
  width: number,
  height: number,
): HTMLVideoElement | HTMLCanvasElement {
  if (!width || !height) return video;
  let mirror = ref.current;
  if (!mirror) {
    const canvas = document.createElement("canvas");
    mirror = { canvas, ctx: canvas.getContext("2d") };
    ref.current = mirror;
  }
  const { canvas, ctx } = mirror;
  if (!ctx) return video;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.setTransform(-1, 0, 0, 1, width, 0);
  ctx.drawImage(video, 0, 0, width, height);
  return canvas;
}

function isPermissionDenied(err: unknown): boolean {
  const name = err instanceof DOMException ? err.name : "";
  return name === "NotAllowedError" || name === "PermissionDeniedError";
}

export function useHandTracking() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handsRef = useRef<TrackedHand[]>([]);
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const persistRef = useRef<Map<Handedness, PersistedHand>>(new Map());
  const thresholdsRef = useRef<GrabThresholds>({ ...DEFAULT_THRESHOLDS });
  const lastVideoTimeRef = useRef(-1);
  const lastTimestampRef = useRef(0);
  const rafRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const runningRef = useRef(false);
  const sessionRef = useRef(0);
  const pointerCleanupRef = useRef<(() => void) | null>(null);
  const mirrorRef = useRef<MirrorCanvas | null>(null);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<HandHud[]>([]);
  const [thresholds, setThresholdsState] = useState<GrabThresholds>({
    ...DEFAULT_THRESHOLDS,
  });

  const setThresholds = useCallback((next: GrabThresholds) => {
    const enter = Math.min(next.enter, next.exit - 0.04);
    const clamped = {
      enter: Math.max(0.08, Math.min(0.8, enter)),
      exit: Math.max(0.12, Math.min(1.2, next.exit)),
    };
    thresholdsRef.current = clamped;
    setThresholdsState(clamped);
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    runningRef.current = false;
    cancelAnimationFrame(rafRef.current);
    pointerCleanupRef.current?.();
    pointerCleanupRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    landmarkerRef.current?.close();
    landmarkerRef.current = null;
    persistRef.current.clear();
    handsRef.current = [];
    lastVideoTimeRef.current = -1;
  }, []);

  const start = useCallback(async (stream: MediaStream) => {
    stop();
    runningRef.current = true;
    const session = sessionRef.current;
    streamRef.current = stream;
    setError(null);
    setStatus("loading-model");

    const stillActive = () => session === sessionRef.current;

    try {
      const video = videoRef.current;
      if (!video) throw new Error("Video element is not ready.");
      video.muted = true;
      video.autoplay = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
      if (!stillActive()) return;

      setStatus("loading-model");
      const { FilesetResolver, HandLandmarker } = await loadMediaPipe();
      const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      if (!stillActive()) return;

      const create = (delegate: "GPU" | "CPU") =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate,
          },
          runningMode: "VIDEO",
          numHands: MAX_HANDS,
          minHandDetectionConfidence: 0.55,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        });

      let landmarker: HandLandmarker;
      try {
        landmarker = await create("GPU");
      } catch {
        landmarker = await create("CPU");
      }
      if (!stillActive()) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;

      setStatus("ready");

      let lastHud = 0;
      // Real elapsed time between detections, so the smoother settles in the
      // same wall-clock time whatever the frame rate happens to be.
      let lastTick = performance.now();

      const tick = () => {
        const tickNow = performance.now();
        const dt = Math.min(0.1, (tickNow - lastTick) / 1000);
        lastTick = tickNow;
        if (!runningRef.current) return;
        const landmarker = landmarkerRef.current;
        const currentVideo = videoRef.current;
        if (!landmarker || !currentVideo || currentVideo.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const frameWidth = currentVideo.videoWidth;
        const frameHeight = currentVideo.videoHeight;
        setFrameShape(frameWidth, frameHeight);

        if (currentVideo.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = currentVideo.currentTime;
          const timestamp = Math.max(
            performance.now(),
            lastTimestampRef.current + 1,
          );
          lastTimestampRef.current = timestamp;

          // The one and only mirroring in the app. Detecting on a flipped
          // frame is what makes the view read like a mirror, and it also means
          // the detector's handedness labels arrive the way it documents them,
          // since it assumes a selfie-mirrored frame to begin with. Everything
          // downstream then works in one consistent space.
          const mirrored = mirrorFrame(mirrorRef, currentVideo, frameWidth, frameHeight);

          let result;
          try {
            result = landmarker.detectForVideo(mirrored, timestamp);
          } catch {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const seen = new Set<Handedness>();
          const nextHands: TrackedHand[] = [];

          const detections = result.landmarks.map((landmarks, index) => {
            const category = result.handedness[index]?.[0]?.categoryName;
            const raw = landmarks.map(toVec3);
            return {
              raw,
              wrist: raw[0],
              label: (category === "Left" ? "Left" : "Right") as Handedness,
            };
          });

          const lastWrist = new Map<Handedness, Vec3>();
          for (const [handedness, persisted] of persistRef.current) {
            lastWrist.set(handedness, persisted.smoothed[0]);
          }
          const claimed = assignHands(detections, lastWrist, MATCH_RADIUS);

          claimed.forEach((detection, handedness) => {
            seen.add(handedness);

            const raw = detection.raw;
            const prev = persistRef.current.get(handedness);
            const smoothed = smoothLandmarks(prev?.smoothed, raw, dt);
            const { pinchDistance, cursor } = pinchMetrics(smoothed);
            const isGrabbing = applyHysteresis(
              prev?.isGrabbing ?? false,
              pinchDistance,
              thresholdsRef.current,
            );

            persistRef.current.set(handedness, {
              smoothed,
              isGrabbing,
              missed: 0,
            });

            nextHands.push({
              handedness,
              landmarks: raw,
              smoothedLandmarks: smoothed,
              cursor,
              pinchDistance,
              isGrabbing,
            });
          });

          for (const [handedness, persisted] of persistRef.current) {
            if (seen.has(handedness)) continue;
            persisted.missed += 1;
            if (persisted.missed >= DROP_AFTER_MISSED_FRAMES) {
              persistRef.current.delete(handedness);
              continue;
            }
            const { pinchDistance, cursor } = pinchMetrics(persisted.smoothed);
            nextHands.push({
              handedness,
              landmarks: persisted.smoothed,
              smoothedLandmarks: persisted.smoothed,
              cursor,
              pinchDistance,
              isGrabbing: persisted.isGrabbing,
            });
          }

          handsRef.current = nextHands;

          const now = performance.now();
          if (now - lastHud >= HUD_INTERVAL_MS) {
            lastHud = now;
            setHud(
              nextHands.map((hand) => ({
                handedness: hand.handedness,
                pinchDistance: hand.pinchDistance,
                isGrabbing: hand.isGrabbing,
              })),
            );
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      if (!stillActive()) return;
      runningRef.current = false;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      if (isPermissionDenied(err)) {
        setStatus("denied");
        setError("Camera permission was denied.");
        return;
      }
      const name = err instanceof DOMException ? err.name : "";
      setStatus("error");
      if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError(
          "Edge did not find a webcam, so it skipped the permission popup. In Windows: Settings → Privacy & security → Camera → turn on Camera access, Let apps access your camera, and Microsoft Edge. In Edge open edge://settings/content/camera and allow sites to ask.",
        );
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to start hand tracking.");
    }
  }, [stop]);

  const enablePointerFallback = useCallback(() => {
    stop();
    runningRef.current = true;
    setError(null);
    setStatus("ready");

    // A mouse has no wrist, so the roll a pour needs has to come from
    // somewhere else: the wheel. Without it the fallback could not tip a jug,
    // which left two of the three recipes impossible to finish without a
    // camera.
    let roll = 0;
    let last: PointerEvent | null = null;

    const publish = (event: PointerEvent) => {
      const grabbing = event.buttons === 1;
      handsRef.current = [
        {
          handedness: "Right",
          landmarks: [],
          smoothedLandmarks: [],
          cursor: {
            x: (event.clientX / window.innerWidth - 0.5) * 7,
            y: -(event.clientY / window.innerHeight - 0.5) * worldY,
            // The same steady height a tracked hand gets. The wheel used to
            // raise and lower it; nothing does now, because the game works
            // out that height for itself.
            z: HAND_HOVER,
          },
          pinchDistance: grabbing ? 0.12 : 0.8,
          isGrabbing: grabbing,
          roll,
        },
      ];
    };

    const sync = (event: PointerEvent) => {
      last = event;
      publish(event);
    };

    const wheel = (event: WheelEvent) => {
      if (!last) return;
      event.preventDefault();
      // A couple of notches is a full tip, which is about how far a wrist goes.
      roll = Math.max(-1.6, Math.min(1.6, roll + event.deltaY * 0.004));
      publish(last);
    };

    window.addEventListener("pointermove", sync);
    window.addEventListener("pointerdown", sync);
    window.addEventListener("pointerup", sync);
    window.addEventListener("wheel", wheel, { passive: false });
    pointerCleanupRef.current = () => {
      window.removeEventListener("pointermove", sync);
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("pointerup", sync);
      window.removeEventListener("wheel", wheel);
    };
  }, [stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return {
    videoRef,
    handsRef,
    hud,
    status,
    error,
    thresholds,
    setThresholds,
    start,
    enablePointerFallback,
  };
}
