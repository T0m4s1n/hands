"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  HAND_CONNECTIONS,
  type GrabThresholds,
  type HandHud,
  type TrackedHand,
} from "@/hooks/useHandTracking";

type DebugOverlayProps = {
  videoRef: RefObject<HTMLVideoElement | null>;
  handsRef: RefObject<TrackedHand[]>;
  hud: HandHud[];
  thresholds: GrabThresholds;
  onThresholdsChange: (next: GrabThresholds) => void;
  visible: boolean;
};

function drawHands(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  hands: TrackedHand[],
) {
  const { videoWidth, videoHeight } = video;
  if (!videoWidth || !videoHeight) return;

  if (ctx.canvas.width !== videoWidth || ctx.canvas.height !== videoHeight) {
    ctx.canvas.width = videoWidth;
    ctx.canvas.height = videoHeight;
  }

  ctx.clearRect(0, 0, videoWidth, videoHeight);

  for (const hand of hands) {
    const color = hand.isGrabbing ? "#4ade80" : "#67e8f9";
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";

    for (const [a, b] of HAND_CONNECTIONS) {
      const start = hand.smoothedLandmarks[a];
      const end = hand.smoothedLandmarks[b];
      if (!start || !end) continue;
      ctx.beginPath();
      ctx.moveTo(start.x * videoWidth, start.y * videoHeight);
      ctx.lineTo(end.x * videoWidth, end.y * videoHeight);
      ctx.stroke();
    }

    hand.smoothedLandmarks.forEach((point, index) => {
      const isPinch = index === 4 || index === 8;
      ctx.fillStyle = isPinch ? "#facc15" : "#f8fafc";
      ctx.beginPath();
      ctx.arc(
        point.x * videoWidth,
        point.y * videoHeight,
        isPinch ? 6 : 3.5,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    });
  }
}

export function DebugOverlay({
  videoRef,
  handsRef,
  hud,
  thresholds,
  onThresholdsChange,
  visible,
}: DebugOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video && visible) {
        const ctx = canvas.getContext("2d");
        if (ctx) drawHands(ctx, video, handsRef.current ?? []);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [handsRef, videoRef, visible]);

  const video = (
    <video
      ref={videoRef}
      className="block w-full scale-x-[-1]"
      autoPlay
      muted
      playsInline
    />
  );

  if (!visible) {
    // The video element must stay mounted and playing (the tracking hook
    // reads frames from it), so it's kept off-screen rather than unmounted.
    return (
      <div className="absolute h-px w-px overflow-hidden opacity-0">
        {video}
      </div>
    );
  }

  return (
    <div className="pointer-events-auto w-[min(100%,20rem)] rounded-2xl border border-white/15 bg-slate-950/80 p-3 text-slate-100 shadow-2xl backdrop-blur-md">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Diagnostics
      </p>
      <div className="relative overflow-hidden rounded-xl bg-black">
        {video}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full scale-x-[-1]"
        />
      </div>

      <div className="mt-3 space-y-3 text-xs">
        <div className="flex flex-wrap gap-2">
          {hud.length === 0 ? (
            <span className="text-slate-400">Show a hand to the camera</span>
          ) : (
            hud.map((hand) => (
              <span
                key={hand.handedness}
                className={`rounded-full px-2 py-1 font-medium ${
                  hand.isGrabbing
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-cyan-500/15 text-cyan-200"
                }`}
              >
                {hand.handedness} pinch {hand.pinchDistance.toFixed(2)}
                {hand.isGrabbing ? " · grab" : ""}
              </span>
            ))
          )}
        </div>

        <label className="block space-y-1 text-slate-300">
          <span>Pinch-in threshold ({thresholds.enter.toFixed(2)})</span>
          <input
            type="range"
            min={0.1}
            max={0.7}
            step={0.01}
            value={thresholds.enter}
            onChange={(event) =>
              onThresholdsChange({
                ...thresholds,
                enter: Number(event.target.value),
              })
            }
            className="w-full accent-cyan-400"
          />
        </label>
        <label className="block space-y-1 text-slate-300">
          <span>Pinch-out threshold ({thresholds.exit.toFixed(2)})</span>
          <input
            type="range"
            min={0.16}
            max={1}
            step={0.01}
            value={thresholds.exit}
            onChange={(event) =>
              onThresholdsChange({
                ...thresholds,
                exit: Number(event.target.value),
              })
            }
            className="w-full accent-cyan-400"
          />
        </label>
      </div>
    </div>
  );
}
