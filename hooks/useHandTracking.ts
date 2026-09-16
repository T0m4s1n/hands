"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Handedness = "Left" | "Right";

export type Vec3 = { x: number; y: number; z: number };

export type TrackedHand = {
  handedness: Handedness;
  landmarks: Vec3[];
  smoothedLandmarks: Vec3[];
  cursor: Vec3;
  pinchDistance: number;
  isGrabbing: boolean;
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

const SMOOTHING = 0.4;
const MAX_HANDS = 2;
const DROP_AFTER_MISSED_FRAMES = 8;
const HUD_INTERVAL_MS = 80;

const DEFAULT_THRESHOLDS: GrabThresholds = { enter: 0.32, exit: 0.52 };

const WORLD_X = 7;
const WORLD_Y = 4.6;
const WORLD_Z = 1.4;

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
    video: HTMLVideoElement,
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

function smoothLandmarks(prev: Vec3[] | undefined, next: Vec3[]): Vec3[] {
  if (!prev || prev.length !== next.length) return next;
  return next.map((point, i) => lerpVec(prev[i], point, SMOOTHING));
}

function landmarkToWorld(lm: Vec3): Vec3 {
  const mirroredX = 1 - lm.x;
  return {
    x: (mirroredX - 0.5) * WORLD_X,
    y: (0.5 - lm.y) * WORLD_Y,
    z: Math.max(-0.8, Math.min(0.8, -lm.z * WORLD_Z)),
  };
}

function pinchMetrics(landmarks: Vec3[]): { pinchDistance: number; cursor: Vec3 } {
  const wrist = landmarks[0];
  const thumbTip = landmarks[4];
  const indexTip = landmarks[8];
  const middleMcp = landmarks[9];
  const handSize = Math.max(dist(wrist, middleMcp), 1e-4);
  const pinchDistance = dist(thumbTip, indexTip) / handSize;
  const pinchMid = {
    x: (thumbTip.x + indexTip.x) * 0.5,
    y: (thumbTip.y + indexTip.y) * 0.5,
    z: (thumbTip.z + indexTip.z) * 0.5,
  };
  return { pinchDistance, cursor: landmarkToWorld(pinchMid) };
}

function applyHysteresis(
  prevGrabbing: boolean,
  pinchDistance: number,
  thresholds: GrabThresholds,
): boolean {
  if (prevGrabbing) return pinchDistance < thresholds.exit;
  return pinchDistance < thresholds.enter;
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

      const tick = () => {
        if (!runningRef.current) return;
        const landmarker = landmarkerRef.current;
        const currentVideo = videoRef.current;
        if (!landmarker || !currentVideo || currentVideo.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        if (currentVideo.currentTime !== lastVideoTimeRef.current) {
          lastVideoTimeRef.current = currentVideo.currentTime;
          const timestamp = Math.max(
            performance.now(),
            lastTimestampRef.current + 1,
          );
          lastTimestampRef.current = timestamp;

          let result;
          try {
            result = landmarker.detectForVideo(currentVideo, timestamp);
          } catch {
            rafRef.current = requestAnimationFrame(tick);
            return;
          }
          const seen = new Set<Handedness>();
          const nextHands: TrackedHand[] = [];

          result.landmarks.forEach((landmarks, index) => {
            const category = result.handedness[index]?.[0]?.categoryName;
            const handedness: Handedness =
              category === "Left" ? "Left" : "Right";
            if (seen.has(handedness)) return;
            seen.add(handedness);

            const raw = landmarks.map(toVec3);
            const prev = persistRef.current.get(handedness);
            const smoothed = smoothLandmarks(prev?.smoothed, raw);
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

    const sync = (event: PointerEvent) => {
      const grabbing = event.buttons === 1;
      handsRef.current = [
        {
          handedness: "Right",
          landmarks: [],
          smoothedLandmarks: [],
          cursor: {
            x: (event.clientX / window.innerWidth - 0.5) * 7,
            y: -(event.clientY / window.innerHeight - 0.5) * 4.6,
            z: 0,
          },
          pinchDistance: grabbing ? 0.12 : 0.8,
          isGrabbing: grabbing,
        },
      ];
    };

    window.addEventListener("pointermove", sync);
    window.addEventListener("pointerdown", sync);
    window.addEventListener("pointerup", sync);
    pointerCleanupRef.current = () => {
      window.removeEventListener("pointermove", sync);
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("pointerup", sync);
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
