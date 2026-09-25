"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  anatomicalHandedness,
  DETECT_HAND_CANDIDATES,
} from "./handAssignment";
import { prepareDetectFrame, type DetectFrame } from "./handFrame";
import { blendWorldDepth, keepGoodHands } from "./handQuality";
import { posedPalm, poseHandWorld } from "./handPose";
import { aimWorld, HAND_HOVER, parkCloudAtAim } from "./handAim";
import { applyGrabLatch, type GrabThresholds } from "./grabLatch";
import { trackFrame, type PersistedHand } from "./trackFrame";
import {
  getAimWorldY,
  screenFromHand as aimScreenFromHand,
  setAimWorldY,
  WORLD_X as AIM_WORLD_X,
} from "./screenAim";
import {
  extrapolateCursor,
  landmarkVelocityToWorld,
} from "./handMotion";

export { applyGrabLatch, type GrabThresholds };

export type Handedness = "Left" | "Right";

export type Vec3 = { x: number; y: number; z: number };

export type TrackedHand = {
  handedness: Handedness;
  /** Live detector output, or a short frozen bridge over a missed frame. */
  tracking?: "live" | "coasting";
  landmarks: Vec3[];
  smoothedLandmarks: Vec3[];
  cursor: Vec3;
  pinchDistance: number;
  isGrabbing: boolean;
  /** Cached world probes so the game does not re-pose every frame. */
  grabPoints?: Vec3[];
  /**
   * The 21 posed world points (lockSpan + deepen). Glove, dots and grab
   * all read this so they cannot disagree about where a knuckle is.
   */
  posed?: Vec3[];
  /** Classifier confidence for the anatomical left/right identity. */
  identityConfidence?: number;
  /** Milliseconds bridged since the detector last saw this hand. */
  missingForMs?: number;
  /** Palm velocity on the table, world units per second. */
  motion?: Vec3;
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

export type HandHud = {
  handedness: Handedness;
  pinchDistance: number;
  isGrabbing: boolean;
};

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MEDIAPIPE_MODULE_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";
/**
 * Newest published bundle first. float32 is the same architecture with less
 * quantisation noise on the bones; if that file is missing we walk down to
 * Google's rolling "latest" and finally the pinned float16 everyone hosts.
 */
const MODEL_CANDIDATES = [
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float32/1/hand_landmarker.task",
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
] as const;

const MAX_HANDS = DETECT_HAND_CANDIDATES;
const HUD_INTERVAL_MS = 80;
/**
 * MediaPipe inference is the expensive part, not drawing the interpolated
 * glove. Thirty-six fresh poses per second keep a swipe honest; R3F then
 * extrapolates the last motion so the mitt does not sit still between samples.
 */
const DETECTION_INTERVAL_MS = 1000 / 42;

/** Generous enter so a natural pinch counts; exit stays open for hysteresis. */
const DEFAULT_THRESHOLDS: GrabThresholds = { enter: 0.46, exit: 0.68 };

const WORLD_X = AIM_WORLD_X;

export function setFrameShape(width: number, height: number) {
  setAimWorldY(width, height);
}


const WORLD_Z = 1.4;

export { HAND_HOVER } from "./handAim";

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
  worldLandmarks?: NormalizedLandmark[][];
  handedness: { categoryName: string; score?: number }[][];
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

function toVec3(lm: NormalizedLandmark): Vec3 {
  return { x: lm.x, y: lm.y, z: lm.z };
}

/**
 * Where a hand is pointing on the screen, in 0..1.
 * Implementation lives in `screenAim.ts` so menu tests can lock the contract.
 */
export function screenFromHand(hand: TrackedHand): { x: number; y: number } {
  return aimScreenFromHand(hand);
}

export function landmarkToWorld(lm: Vec3): Vec3 {
  const worldY = getAimWorldY();
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
 * World-space points used to test whether a hand can reach an object.
 *
 * Runs through the same `poseHandWorld` pipeline as the glove (size lock,
 * depth stretch, dorsal turn), so a tip that looks on the spoon is the tip
 * the game tests. Recognition is unchanged — pinch still uses raw landmarks.
 */
export function handGrabPoints(landmarks: Vec3[]): Vec3[] {
  const posed = poseHandWorld(landmarks, landmarkToWorld);
  if (posed.length < 21) return [];
  const aim = aimWorld(landmarks, landmarkToWorld);
  parkCloudAtAim(posed, posedPalm(posed), aim);
  const palm = posedPalm(posed);
  const pick = (i: number) => ({
    x: posed[i].x,
    y: posed[i].y,
    z: posed[i].z,
  });
  return [aim, palm, pick(0), pick(5), pick(9), pick(17), pick(4), pick(8)];
}

function copyPoint(point: { x: number; y: number; z: number }): Vec3 {
  return { x: point.x, y: point.y, z: point.z };
}

function worldMetrics(landmarks: Vec3[]): {
  cursor: Vec3;
  grabPoints: Vec3[];
  cloud: Vec3[];
} {
  const posed = poseHandWorld(landmarks, landmarkToWorld);
  if (posed.length < 21) {
    const aim = aimWorld(landmarks, landmarkToWorld);
    return { cursor: aim, grabPoints: [aim], cloud: [] };
  }
  const aim = aimWorld(landmarks, landmarkToWorld);
  parkCloudAtAim(posed, posedPalm(posed), aim);
  const cloud = posed.map(copyPoint);
  const palm = posedPalm(posed);
  const pick = (i: number) => copyPoint(posed[i]);
  return {
    cursor: { x: aim.x, y: aim.y, z: HAND_HOVER },
    grabPoints: [aim, palm, pick(0), pick(5), pick(9), pick(17), pick(4), pick(8)],
    cloud,
  };
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
  const detectFrameRef = useRef<DetectFrame | null>(null);

  const [status, setStatus] = useState<TrackingStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hud, setHud] = useState<HandHud[]>([]);
  const [thresholds, setThresholdsState] = useState<GrabThresholds>({
    ...DEFAULT_THRESHOLDS,
  });
  const [inputMode, setInputMode] = useState<"camera" | "pointer">("camera");

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
    setInputMode("camera");
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

      const create = (modelAssetPath: string, delegate: "GPU" | "CPU") =>
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath,
            delegate,
          },
          runningMode: "VIDEO",
          // Look past two so a second body in the frame can be discarded.
          numHands: MAX_HANDS,
          // Find the palm even in a lifted-but-still-dim frame.
          minHandDetectionConfidence: 0.32,
          // If the bones look unsure, re-run palm detection instead of
          // dragging last frame's box — that is what turns a blink into
          // a broken skeleton.
          minHandPresenceConfidence: 0.55,
          minTrackingConfidence: 0.5,
        });

      let landmarker: HandLandmarker | undefined;
      let lastError: unknown;
      for (const model of MODEL_CANDIDATES) {
        try {
          landmarker = await create(model, "GPU");
          break;
        } catch (gpuError) {
          try {
            landmarker = await create(model, "CPU");
            break;
          } catch (cpuError) {
            lastError = cpuError ?? gpuError;
          }
        }
      }
      if (!landmarker) {
        throw lastError instanceof Error
          ? lastError
          : new Error("No hand model could be loaded.");
      }
      if (!stillActive()) {
        landmarker.close();
        return;
      }
      landmarkerRef.current = landmarker;

      setStatus("ready");

      let lastHud = 0;
      let lastDetectionAt = -Infinity;
      let detectedHands: TrackedHand[] = [];

      const publish = (ageSec: number) => {
        if (ageSec <= 0) {
          handsRef.current = detectedHands;
          return;
        }
        handsRef.current = detectedHands.map((hand) => ({
          ...hand,
          cursor: extrapolateCursor(hand.cursor, hand.motion, ageSec),
        }));
      };

      const tick = () => {
        const tickNow = performance.now();
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

        if (tickNow - lastDetectionAt >= DETECTION_INTERVAL_MS) {
          const detectionDt =
            lastDetectionAt === -Infinity
              ? 1 / 36
              : Math.min(0.12, (tickNow - lastDetectionAt) / 1000);
          lastDetectionAt = tickNow;
          lastVideoTimeRef.current = currentVideo.currentTime;
          const timestamp = Math.max(
            tickNow,
            lastTimestampRef.current + 1,
          );
          lastTimestampRef.current = timestamp;

          // The one and only mirroring in the app. Detecting on a flipped
          // frame is what makes the view read like a mirror, and it also means
          // the detector's handedness labels arrive the way it documents them,
          // since it assumes a selfie-mirrored frame to begin with. Everything
          // downstream then works in one consistent space.
          const framed = prepareDetectFrame(
            detectFrameRef,
            currentVideo,
            frameWidth,
            frameHeight,
            tickNow,
          );

          try {
            const result = landmarker.detectForVideo(framed, timestamp);
            const inputMirrored = framed !== currentVideo;
            const detections = keepGoodHands(
              result.landmarks.map((landmarks, index) => {
                const reported = result.handedness[index]?.[0];
                const image = landmarks.map(toVec3);
                const world = result.worldLandmarks?.[index]?.map(toVec3);
                const raw = blendWorldDepth(image, world);
                return {
                  raw,
                  wrist: raw[0],
                  label: anatomicalHandedness(reported?.categoryName, inputMirrored),
                  labelScore: reported?.score ?? 0.5,
                };
              }),
            );

            const drafts = trackFrame(
              persistRef.current,
              detections,
              detectionDt,
              thresholdsRef.current,
            );
            const worldY = getAimWorldY();
            detectedHands = drafts.map((draft) => {
              const posed = worldMetrics(draft.smoothedLandmarks);
              const persisted = persistRef.current.get(draft.handedness);
              const velPerSec = persisted
                ? {
                    x: persisted.velocity.x / detectionDt,
                    y: persisted.velocity.y / detectionDt,
                    z: persisted.velocity.z / detectionDt,
                  }
                : { x: 0, y: 0, z: 0 };
              return {
                ...draft,
                cursor: posed.cursor,
                grabPoints: posed.grabPoints,
                posed: posed.cloud,
                motion: landmarkVelocityToWorld(velPerSec, WORLD_X, worldY),
              };
            });

            if (tickNow - lastHud >= HUD_INTERVAL_MS) {
              lastHud = tickNow;
              setHud(
                detectedHands.map((hand) => ({
                  handedness: hand.handedness,
                  pinchDistance: hand.pinchDistance,
                  isGrabbing: hand.isGrabbing,
                })),
              );
            }
          } catch {
            // Keep the last good pose; a duplicate video timestamp must not
            // freeze the published hands for the rest of the session.
          }
        }

        publish((tickNow - lastDetectionAt) / 1000);
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
    setInputMode("pointer");
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
          tracking: "live",
          landmarks: [],
          smoothedLandmarks: [],
          cursor: {
            x: (event.clientX / window.innerWidth - 0.5) * 7,
            y: -(event.clientY / window.innerHeight - 0.5) * getAimWorldY(),
            // The same steady height a tracked hand gets. The wheel used to
            // raise and lower it; nothing does now, because the game works
            // out that height for itself.
            z: HAND_HOVER,
          },
          pinchDistance: grabbing ? 0.12 : 0.8,
          isGrabbing: grabbing,
          grabPoints: [
            {
              x: (event.clientX / window.innerWidth - 0.5) * 7,
              y: -(event.clientY / window.innerHeight - 0.5) * getAimWorldY(),
              z: HAND_HOVER,
            },
          ],
          identityConfidence: 1,
          missingForMs: 0,
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

    // A hand already, at the centre, so the sync screen can lock without
    // waiting for the first move. A mouse that has not moved yet is still
    // a mouse.
    publish({
      clientX: window.innerWidth * 0.5,
      clientY: window.innerHeight * 0.5,
      buttons: 0,
    } as PointerEvent);

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
    inputMode,
  };
}
