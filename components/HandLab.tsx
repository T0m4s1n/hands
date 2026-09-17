"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EnableCameraButton } from "@/components/EnableCameraButton";
import { handTuning } from "@/components/GloveHand";
import { useHandTracking, type TrackedHand } from "@/hooks/useHandTracking";

const HandLabScene = dynamic(
  () => import("@/components/HandLabScene").then((mod) => mod.HandLabScene),
  { ssr: false },
);

/** The knobs worth reaching for, in the order you tend to reach for them. */
const KNOBS: {
  key: keyof typeof handTuning;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    key: "stillRate",
    label: "Suavizado en reposo",
    hint: "Más bajo quita temblor; demasiado bajo y la mano flota",
    min: 1,
    max: 30,
    step: 0.5,
  },
  {
    key: "movingRate",
    label: "Suavizado en movimiento",
    hint: "Más alto responde antes y deja pasar más ruido",
    min: 5,
    max: 60,
    step: 1,
  },
  {
    key: "depthDamping",
    label: "Amortiguación de profundidad",
    hint: "La profundidad es el eje más ruidoso",
    min: 0.05,
    max: 1,
    step: 0.05,
  },
  {
    key: "palmReach",
    label: "Zona muerta de la palma",
    hint: "Más bajo exagera el giro de muñeca; más alto lo apaga",
    min: 0.7,
    max: 1,
    step: 0.01,
  },
  {
    key: "depthLean",
    label: "Sensibilidad de inclinación",
    hint: "Cuánta profundidad reportada cuenta como giro completo",
    min: 0.02,
    max: 0.4,
    step: 0.01,
  },
  {
    key: "turnRate",
    label: "Velocidad de giro",
    hint: "Qué tan rápido asienta la palma una orientación nueva",
    min: 1,
    max: 30,
    step: 0.5,
  },
  {
    key: "fingerReach",
    label: "Zona muerta de dedos",
    hint: "Más alto curva los dedos de más; más bajo no los curva",
    min: 0.6,
    max: 1,
    step: 0.01,
  },
];

const DEFAULTS = { ...handTuning };

function useHandReadout(handsRef: { current: TrackedHand[] }) {
  const [rows, setRows] = useState<
    { handedness: string; pinch: number; grabbing: boolean; span: number }[]
  >([]);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      const hands = handsRef.current ?? [];
      setRows(
        hands.map((hand) => {
          const wrist = hand.smoothedLandmarks[0];
          const middle = hand.smoothedLandmarks[9];
          const span =
            wrist && middle
              ? Math.hypot(wrist.x - middle.x, wrist.y - middle.y)
              : 0;
          return {
            handedness: hand.handedness,
            pinch: hand.pinchDistance,
            grabbing: hand.isGrabbing,
            span,
          };
        }),
      );
      frame = window.setTimeout(read, 120);
    };
    read();
    return () => window.clearTimeout(frame);
  }, [handsRef]);

  return rows;
}

export function HandLab() {
  const { videoRef, handsRef, status, error, start, enablePointerFallback } =
    useHandTracking();
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [, bump] = useState(0);
  const rows = useHandReadout(handsRef);

  const ready = status === "ready";
  const loading = status === "loading-model";

  // The scene never needs to re-render for a slider: the tuning object is read
  // inside the frame loop. Keeping its element identity stable avoids
  // rebuilding the canvas on every drag.
  const scene = useMemo(
    () => <HandLabScene handsRef={handsRef} showLandmarks={showLandmarks} />,
    [handsRef, showLandmarks],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#141820] text-stone-100">
      <div className="absolute inset-0">{scene}</div>
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="pointer-events-none absolute inset-0 z-10 flex justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto flex w-64 flex-col gap-3 self-start rounded-2xl border border-white/10 bg-stone-950/80 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h1 className="text-sm font-semibold">Laboratorio de manos</h1>
            <Link
              href="/"
              className="text-xs text-stone-400 underline-offset-2 hover:underline"
            >
              al juego
            </Link>
          </div>

          <label className="flex items-center gap-2 text-xs text-stone-300">
            <input
              type="checkbox"
              checked={showLandmarks}
              onChange={(event) => setShowLandmarks(event.target.checked)}
            />
            Mostrar puntos del tracking
          </label>

          <div className="space-y-1 text-xs">
            {rows.length === 0 ? (
              <p className="text-stone-500">Ninguna mano detectada</p>
            ) : (
              rows.map((row) => (
                <p key={row.handedness} className="flex justify-between gap-2">
                  <span className="text-stone-400">{row.handedness}</span>
                  <span className="font-mono">
                    pellizco {row.pinch.toFixed(2)}
                    {row.grabbing ? " ·agarra" : ""}
                  </span>
                </p>
              ))
            )}
          </div>
        </div>

        <div className="pointer-events-auto flex w-72 flex-col gap-3 self-start rounded-2xl border border-white/10 bg-stone-950/80 p-4 backdrop-blur">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Ajustes</h2>
            <button
              type="button"
              onClick={() => {
                Object.assign(handTuning, DEFAULTS);
                bump((value) => value + 1);
              }}
              className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-stone-300 hover:bg-stone-800"
            >
              restablecer
            </button>
          </div>

          {KNOBS.map((knob) => (
            <label key={knob.key} className="block">
              <span className="flex justify-between text-xs text-stone-300">
                {knob.label}
                <span className="font-mono text-stone-400">
                  {handTuning[knob.key].toFixed(2)}
                </span>
              </span>
              <input
                type="range"
                className="w-full accent-amber-400"
                min={knob.min}
                max={knob.max}
                step={knob.step}
                value={handTuning[knob.key]}
                onChange={(event) => {
                  handTuning[knob.key] = Number(event.target.value);
                  bump((value) => value + 1);
                }}
              />
              <span className="block text-[11px] leading-4 text-stone-500">
                {knob.hint}
              </span>
            </label>
          ))}
        </div>
      </div>

      {!ready && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-950/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-900/90 p-6 text-center shadow-2xl">
            <h1 className="text-2xl font-semibold tracking-tight">
              Laboratorio de manos
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              {loading
                ? "Cámara lista. Cargando el modelo de seguimiento…"
                : "Solo las manos, sin juego, para afinar el seguimiento."}
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
