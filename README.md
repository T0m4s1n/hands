# Hand Tracker

A real-time hand-tracking demo built with Next.js, react-three-fiber, and
MediaPipe's Hand Landmarker. It mirrors your webcam feed into a 3D scene and
lets you pinch (thumb to index finger) to grab and move objects — no
controllers, no server round-trips, everything runs locally in the browser.

## How it works

- [`hooks/useHandTracking.ts`](hooks/useHandTracking.ts) owns the camera
  stream and the MediaPipe `HandLandmarker` model. Each video frame produces
  per-hand landmarks, which are smoothed and converted into a pinch distance
  and a 3D cursor position. A hysteresis window (`enter` / `exit`
  thresholds) turns "pinch distance" into a stable `isGrabbing` boolean so
  the gesture doesn't flicker near the threshold.
- [`components/HandTrackedScene.tsx`](components/HandTrackedScene.tsx) renders
  the Three.js scene: one cursor per hand and a set of grabbable cubes with
  simple gravity when dropped.
- [`components/HandTrackedApp.tsx`](components/HandTrackedApp.tsx) wires the
  camera permission flow, the scene, and an optional diagnostics panel
  together.
- [`components/DebugOverlay.tsx`](components/DebugOverlay.tsx) is the
  diagnostics panel: the raw camera feed with landmark overlay, per-hand
  pinch state, and live sliders for the grab thresholds.

Model and WASM assets are loaded from a CDN at runtime (see the constants at
the top of `useHandTracking.ts`), so no large binaries live in this repo.

## Requirements

- Node.js 18+
- A webcam
- A Chromium-based browser (Chrome or Edge) for GPU-accelerated inference;
  other modern browsers fall back to CPU delegate automatically

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), allow camera access,
and pinch over a cube to grab it. If you don't have a camera handy, use
"Continue with mouse instead" on the permission screen to drive the demo
with pointer input.

## Scripts

| Command         | Purpose                          |
| ---------------- | --------------------------------- |
| `npm run dev`   | Start the dev server              |
| `npm run build` | Production build                  |
| `npm run start` | Serve the production build        |
| `npm run lint`  | Run ESLint                        |

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · three.js ·
@react-three/fiber · @react-three/drei · @mediapipe/tasks-vision
