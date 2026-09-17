"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DebugOverlay } from "@/components/DebugOverlay";
import { EnableCameraButton } from "@/components/EnableCameraButton";
import type { StageStatus } from "@/components/CoffeeGame";
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
  const [stage, setStage] = useState<StageStatus | null>(null);
  const [round, setRound] = useState(0);

  const showGate = status !== "ready";
  const loading = status === "loading-model";

  // The scene publishes stage updates several times a second; keeping its
  // element identity stable stops those from re-rendering the whole canvas.
  const scene = useMemo(
    () => (
      <HandTrackedScene handsRef={handsRef} onStatus={setStage} round={round} />
    ),
    [handsRef, round],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#160e07] text-amber-50">
      <div className="absolute inset-0">{scene}</div>

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
              className="rounded-full border border-white/15 bg-stone-950/75 px-3 py-1.5 text-xs font-medium text-stone-200 backdrop-blur hover:bg-stone-900"
            >
              {showDebug ? "Hide diagnostics" : "Show diagnostics"}
            </button>
            <p className="max-w-[16rem] text-right text-xs leading-5 text-stone-400">
              El seguimiento corre en tu navegador — no se sube nada. Pellizca
              con pulgar e índice para tomar, abre la mano para soltar.
            </p>
          </div>
        </div>

        <div className="pointer-events-none flex justify-center">
          {stage && (
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-stone-950/75 px-5 py-3 backdrop-blur">
              {stage.done ? (
                <div className="pointer-events-auto flex flex-col items-center gap-2">
                  <p className="text-sm font-medium text-amber-200">
                    ¡Café listo! Cinco de cinco etapas completadas.
                  </p>
                  <button
                    type="button"
                    onClick={() => setRound((value) => value + 1)}
                    className="rounded-full border border-white/15 bg-stone-900/80 px-4 py-1.5 text-xs font-medium text-stone-100 hover:bg-stone-800"
                  >
                    Preparar otro
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-semibold tracking-tight">
                      {stage.index + 1}. {stage.title}
                    </p>
                    <p className="text-xs text-stone-400">
                      Etapa {stage.index + 1} de {stage.total}
                    </p>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-stone-300">
                    {stage.near && !stage.holding ? (
                      <span className="font-medium text-amber-300">
                        Cierra la mano para tomarlo
                      </span>
                    ) : (
                      stage.instruction
                    )}
                  </p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div
                      className={`h-full rounded-full transition-[width] duration-100 ${
                        stage.holding ? "bg-amber-300" : "bg-amber-600"
                      }`}
                      style={{ width: `${Math.round(stage.progress * 100)}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showGate && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-stone-950/75 p-6 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-stone-900/90 p-6 text-center shadow-2xl">
            <h1 className="text-2xl font-semibold tracking-tight text-amber-100">
              Café a mano
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-300">
              {loading
                ? "Cámara lista. Cargando el modelo de seguimiento de manos…"
                : "Activa tu cámara para preparar café con las manos. El navegador te pedirá permiso — acéptalo para continuar."}
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
