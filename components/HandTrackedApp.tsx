"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { DebugOverlay } from "@/components/DebugOverlay";
import { EnableCameraButton } from "@/components/EnableCameraButton";
import { useHandTracking } from "@/hooks/useHandTracking";

const HandTrackedScene = dynamic(
  () =>
    import("@/components/HandTrackedScene").then((mod) => mod.HandTrackedScene),
  { ssr: false },
);

export function HandTrackedApp() {
  const {
    videoRef,
    handsRef,
    hud,
    status,
    error,
    thresholds,
    setThresholds,
    start,
    enablePointerFallback,
  } = useHandTracking();
  const [showDebug, setShowDebug] = useState(false);

  const showGate = status !== "ready";
  const loading = status === "loading-model";

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#070b14] text-slate-100">
      <div className="absolute inset-0">
        <HandTrackedScene handsRef={handsRef} />
      </div>

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <DebugOverlay
            videoRef={videoRef}
            handsRef={handsRef}
            hud={hud}
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            visible={showDebug}
          />

          <div className="pointer-events-auto flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={() => setShowDebug((value) => !value)}
              className="rounded-full border border-white/15 bg-slate-950/70 px-3 py-1.5 text-xs font-medium text-slate-200 backdrop-blur hover:bg-slate-900"
            >
              {showDebug ? "Hide diagnostics" : "Show diagnostics"}
            </button>
            <p className="max-w-[16rem] text-right text-xs leading-5 text-slate-400">
              Tracking runs entirely in your browser — nothing is uploaded.
              Pinch thumb to index over a cube to grab it, then open your
              fingers to release.
            </p>
          </div>
        </div>

        <div className="pointer-events-none flex justify-center">
          <div className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-center text-sm text-slate-200 backdrop-blur">
            Pinch to grab · move your hand · open to drop
          </div>
        </div>
      </div>

      {showGate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-center shadow-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              Hand Tracker
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              {loading
                ? "Camera access granted. Loading the hand-tracking model…"
                : "Enable your camera to control the scene with hand gestures. Your browser will ask for permission — allow it to continue."}
            </p>
            {error && (
              <p className="mt-3 text-left text-sm leading-6 text-amber-200">
                {error}
              </p>
            )}
            {!loading && (
              <EnableCameraButton
                onStream={(stream) => void start(stream)}
                onPointerFallback={enablePointerFallback}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
