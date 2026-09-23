"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { EnableCameraButton } from "@/components/EnableCameraButton";
import { handTuning, handView } from "@/components/RobotHand";
import { Sheet } from "@/components/ui";
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
    max: 40,
    step: 0.5,
  },
  {
    key: "movingRate",
    label: "Suavizado en movimiento",
    hint: "Más alto responde antes y deja pasar más ruido",
    min: 5,
    max: 120,
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
    key: "depthScale",
    label: "Profundidad de la mano",
    hint: "Más alto separa los dedos en profundidad y se tapan entre ellos",
    min: 0,
    max: 4,
    step: 0.1,
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

/** A labelled slider, matching the one control style the app uses everywhere. */
function Knob({
  label,
  hint,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="t-footnote flex justify-between text-label-2">
        {label}
        <span className="font-mono text-label-3 tabular-nums">
          {value.toFixed(2)}
        </span>
      </span>
      <input
        type="range"
        className="mt-1.5 w-full"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="t-caption mt-1 block text-label-3">{hint}</span>
    </label>
  );
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="t-footnote flex min-h-[2.25rem] cursor-pointer items-center gap-2.5 text-label-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[var(--color-tint)]"
      />
      {children}
    </label>
  );
}

export function HandLab() {
  const { videoRef, handsRef, status, error, start, enablePointerFallback } =
    useHandTracking();
  const [showLandmarks, setShowLandmarks] = useState(true);
  const [, bump] = useState(0);
  const rows = useHandReadout(handsRef);

  const ready = status === "ready";
  const loading = status === "loading-model";

  // Ask for the camera straight away. Once permission is granted this route
  // costs a reload and nothing else, which is the point of having it.
  useEffect(() => {
    if (status !== "idle") return;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: true })
      .then((stream) => {
        if (cancelled) stream.getTracks().forEach((track) => track.stop());
        else void start(stream);
      })
      .catch(() => {
        // Permission not granted yet: the gate below takes over.
      });
    return () => {
      cancelled = true;
    };
  }, [status, start]);

  // The scene never needs to re-render for a slider: the tuning object is read
  // inside the frame loop. Keeping its element identity stable avoids
  // rebuilding the canvas on every drag.
  const scene = useMemo(
    () => <HandLabScene handsRef={handsRef} showLandmarks={showLandmarks} />,
    [handsRef, showLandmarks],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#141820] text-label">
      <div className="absolute inset-0">{scene}</div>
      <video ref={videoRef} className="hidden" playsInline muted />

      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-4 overflow-y-auto p-4 sm:flex-row sm:justify-between sm:overflow-visible sm:p-6">
        <Sheet className="pointer-events-auto flex w-full flex-col gap-4 p-5 sm:w-64 sm:self-start">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="t-headline">Laboratorio</h1>
            <Link
              href="/jugar"
              className="t-footnote text-tint transition hover:brightness-110"
            >
              al juego
            </Link>
          </div>

          <Toggle checked={showLandmarks} onChange={setShowLandmarks}>
            Mostrar puntos del tracking
          </Toggle>

          <div className="border-t border-separator pt-3">
            <p className="t-caption text-label-3">
              La mano se arma directamente sobre los puntos, así que la
              lateralidad sale sola: no hay modelo que elegir ni cara que
              corregir.
            </p>
            <Toggle
              checked={handView.showPalm}
              onChange={(next) => {
                handView.showPalm = next;
                bump((value) => value + 1);
              }}
            >
              Placa de palma
            </Toggle>
          </div>

          <div className="border-t border-separator pt-3">
            {rows.length === 0 ? (
              <p className="t-footnote text-label-3">Ninguna mano detectada</p>
            ) : (
              rows.map((row) => (
                <p
                  key={row.handedness}
                  className="t-footnote flex justify-between gap-2 text-label-2"
                >
                  <span>{row.handedness}</span>
                  <span className="font-mono text-label-3 tabular-nums">
                    {row.pinch.toFixed(2)}
                    {row.grabbing ? " · agarra" : ""}
                  </span>
                </p>
              ))
            )}
          </div>
        </Sheet>

        <Sheet className="pointer-events-auto flex w-full flex-col gap-4 p-5 sm:w-72 sm:self-start">
          <div className="flex items-center justify-between gap-2">
            <h2 className="t-headline">Ajustes</h2>
            <button
              type="button"
              onClick={() => {
                Object.assign(handTuning, DEFAULTS);
                bump((value) => value + 1);
              }}
              className="t-footnote squircle rounded-full bg-fill px-3 py-1.5 text-label-2 transition hover:bg-fill-2"
            >
              Restablecer
            </button>
          </div>

          {KNOBS.map((knob) => (
            <Knob
              key={knob.key}
              label={knob.label}
              hint={knob.hint}
              min={knob.min}
              max={knob.max}
              step={knob.step}
              value={handTuning[knob.key]}
              onChange={(value) => {
                handTuning[knob.key] = value;
                bump((count) => count + 1);
              }}
            />
          ))}
        </Sheet>
      </div>

      {!ready && (
        <div className="scrim absolute inset-0 z-20 flex items-center justify-center p-6">
          <Sheet className="w-full max-w-md p-8 text-center">
            <h1 className="t-large-title">Laboratorio de manos</h1>
            <p className="t-body mt-3 text-label-2">
              {loading
                ? "Cámara lista. Cargando el modelo de seguimiento…"
                : "Solo las manos, sin juego, para afinar el seguimiento."}
            </p>
            {error && (
              <p className="t-subhead mt-4 rounded-tile bg-fill p-3 text-left text-label-2">
                {error}
              </p>
            )}
            {!loading && (
              <EnableCameraButton
                onStream={(stream) => void start(stream)}
                onPointerFallback={enablePointerFallback}
              />
            )}
          </Sheet>
        </div>
      )}
    </div>
  );
}
