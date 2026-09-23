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
    <div className="material squircle pointer-events-auto w-[min(100%,20rem)] rounded-card p-3">
      <p className="t-caption mb-2 font-semibold uppercase tracking-[0.12em] text-label-3">
        Diagnóstico
      </p>
      <div className="squircle relative overflow-hidden rounded-tile bg-black">
        {video}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full scale-x-[-1]"
        />
      </div>

      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {hud.length === 0 ? (
            <span className="t-caption text-label-3">
              Muestra una mano a la cámara
            </span>
          ) : (
            hud.map((hand) => (
              <span
                key={hand.handedness}
                className={`t-caption squircle rounded-full px-2.5 py-1 font-medium tabular-nums ${
                  hand.isGrabbing
                    ? "bg-tint/20 text-tint"
                    : "bg-fill text-label-2"
                }`}
              >
                {hand.handedness} · {hand.pinchDistance.toFixed(2)}
                {hand.isGrabbing ? " · agarra" : ""}
              </span>
            ))
          )}
        </div>

        <label className="block space-y-1.5">
          <span className="t-caption flex justify-between text-label-2">
            Cierre del pellizco
            <span className="font-mono text-label-3 tabular-nums">
              {thresholds.enter.toFixed(2)}
            </span>
          </span>
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
            className="w-full"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="t-caption flex justify-between text-label-2">
            Apertura de la mano
            <span className="font-mono text-label-3 tabular-nums">
              {thresholds.exit.toFixed(2)}
            </span>
          </span>
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
            className="w-full"
          />
        </label>
      </div>
    </div>
  );
}
