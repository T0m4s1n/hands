"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { DebugOverlay } from "@/components/DebugOverlay";
import { EnableCameraButton } from "@/components/EnableCameraButton";
import type { StageStatus } from "@/components/CoffeeGame";
import { RECIPES, grade, type Recipe } from "@/components/coffee/recipes";
import { effects } from "@/components/coffee/grade";
import { Button, IconButton, Meter, ScoreRing, Sheet } from "@/components/ui";
import { useHandTracking } from "@/hooks/useHandTracking";

const HandTrackedScene = dynamic(
  () =>
    import("@/components/HandTrackedScene").then((mod) => mod.HandTrackedScene),
  { ssr: false },
);

/**
 * How a mark looks: deep rust when it went badly, bright gold when it went
 * well. It stays inside the warm half of the wheel so it never fights the
 * scene, and every bar it colours has its number beside it — colour alone is
 * never the only way to read a score here.
 */
function markColour(mark: number): string {
  const safe = Math.max(0, Math.min(1, mark));
  return `hsl(${8 + safe * 38} ${85 - safe * 16}% ${42 + safe * 18}%)`;
}

function average(marks: readonly number[]): number {
  if (marks.length === 0) return 0;
  return marks.reduce((sum, mark) => sum + mark, 0) / marks.length;
}

/* ---------- glyphs ---------- */

function CupGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 9h12v5.5A4.5 4.5 0 0 1 11.5 19h-3A4.5 4.5 0 0 1 4 14.5V9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <path
        d="M8 3v2.5M12 3v2.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GlowGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 2.6v2.6M12 18.8v2.6M2.6 12h2.6M18.8 12h2.6M5.4 5.4l1.8 1.8M16.8 16.8l1.8 1.8M18.6 5.4l-1.8 1.8M7.2 16.8l-1.8 1.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SlidersGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
      <path
        d="M4 8h10M18 8h2M4 16h4M12 16h8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <circle cx="16" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="10" cy="16" r="2.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

/* ---------- pieces ---------- */

/** One bar per stage: where you are, and what everything behind you scored. */
function Scorecard({
  recipe,
  marks,
  current,
}: {
  recipe: Recipe;
  marks: readonly number[];
  current: number;
}) {
  return (
    <ol className="flex gap-2">
      {recipe.stages.map((stage, i) => {
        const mark = marks[i];
        const here = i === current;
        return (
          <li key={stage.id} className="flex-1">
            <div
              className={`h-1 overflow-hidden rounded-full ${
                here ? "bg-tint/35" : "bg-fill"
              }`}
            >
              {mark !== undefined && (
                <div
                  className="h-full rounded-full transition-[width] duration-500 ease-sheet"
                  style={{
                    width: `${Math.round(mark * 100)}%`,
                    background: markColour(mark),
                  }}
                />
              )}
            </div>
            <p
              className={`t-caption mt-1.5 truncate ${
                here ? "text-label" : "text-label-3"
              }`}
            >
              {stage.title}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

/** The bar along the bottom while a coffee is being made. */
function StageHud({ recipe, stage }: { recipe: Recipe; stage: StageStatus }) {
  const prompt = stage.hurry
    ? "Se acaba el tiempo — la etapa se cierra con lo que lleves"
    : stage.near && !stage.holding
      ? "Pellizca para tomarlo"
      : stage.instruction;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center p-4 sm:p-6">
      <Sheet className="w-full max-w-lg px-5 py-4">
        <div className="flex items-center gap-3">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tint text-[0.8125rem] font-semibold text-tint-ink tabular-nums"
            aria-hidden
          >
            {stage.index + 1}
          </span>
          <div className="min-w-0 flex-1" role="status" aria-live="polite">
            <p className="t-headline truncate">{stage.title}</p>
            <p
              className={`t-subhead line-clamp-2 ${
                stage.hurry
                  ? "text-[color:hsl(18_90%_62%)]"
                  : stage.near && !stage.holding
                    ? "text-tint"
                    : "text-label-2"
              }`}
            >
              {prompt}
            </p>
          </div>
          <p className="t-footnote shrink-0 text-right text-label-3 tabular-nums">
            {recipe.name}
            <br />
            {stage.index + 1} de {stage.total}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <Meter
            value={stage.progress}
            colour={markColour(stage.quality)}
            className="flex-1"
          />
          <p className="t-footnote w-40 shrink-0 text-right text-label-3 tabular-nums">
            {stage.detail}
          </p>
        </div>

        <div className="mt-4 border-t border-separator pt-3">
          <Scorecard
            recipe={recipe}
            marks={stage.marks}
            current={stage.index}
          />
        </div>
      </Sheet>
    </div>
  );
}

/** A card on the menu. The whole card is the target, not a button inside it. */
function RecipeCard({
  recipe,
  onPick,
}: {
  recipe: Recipe;
  onPick: (recipe: Recipe) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(recipe)}
      className="material-thick squircle group flex flex-col rounded-card p-5 text-left transition duration-300 ease-sheet hover:border-tint/45 active:scale-[0.98]"
    >
      <span
        className="squircle flex h-14 w-14 items-center justify-center rounded-tile ring-1 ring-inset ring-white/15 transition duration-300 ease-sheet group-hover:scale-105"
        style={{ background: recipe.colour }}
      >
        <CupGlyph className="h-7 w-7 text-white/85" />
      </span>
      <span className="t-headline mt-4">{recipe.name}</span>
      <span className="t-subhead mt-1 text-label-2">{recipe.blurb}</span>
      <span className="flex-1" aria-hidden />
      <span className="t-caption mt-4 pt-1 text-label-3">
        {recipe.stages.map((stage) => stage.title).join(" · ")}
      </span>
    </button>
  );
}

/* ---------- screen ---------- */

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
  const [glow, setGlow] = useState(effects.bloom);
  const [stage, setStage] = useState<StageStatus | null>(null);
  const [recipe, setRecipe] = useState<Recipe>(RECIPES[0]);
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);

  const showGate = status !== "ready";
  const loading = status === "loading-model";

  const startBrew = (next: Recipe) => {
    setRecipe(next);
    setStage(null);
    setPlaying(true);
    setRound((value) => value + 1);
  };

  // The scene publishes stage updates several times a second; keeping its
  // element identity stable stops those from re-rendering the whole canvas.
  const scene = useMemo(
    () => (
      <HandTrackedScene
        recipe={recipe}
        handsRef={handsRef}
        onStatus={setStage}
        round={round}
        running={playing}
      />
    ),
    [recipe, handsRef, round, playing],
  );

  const finished = playing && stage?.done === true;
  const finalMark = finished ? average(stage.marks) : 0;

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas text-label">
      <div className="absolute inset-0">{scene}</div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-4 p-4 sm:p-6">
        <div className="pointer-events-auto">
          <DebugOverlay
            videoRef={videoRef}
            handsRef={handsRef}
            hud={hud}
            thresholds={thresholds}
            onThresholdsChange={setThresholds}
            visible={showDebug}
          />
        </div>
        <div className="pointer-events-auto flex gap-2">
          <IconButton
            label={glow ? "Quitar brillo" : "Poner brillo"}
            aria-pressed={glow}
            onClick={() => {
              effects.bloom = !effects.bloom;
              setGlow(effects.bloom);
            }}
            className={glow ? "text-tint" : ""}
          >
            <GlowGlyph />
          </IconButton>
          <IconButton
            label={showDebug ? "Ocultar diagnóstico" : "Ver diagnóstico"}
            aria-pressed={showDebug}
            onClick={() => setShowDebug((value) => !value)}
            className={showDebug ? "text-tint" : ""}
          >
            <SlidersGlyph />
          </IconButton>
        </div>
      </div>

      {playing && stage && !stage.done && (
        <StageHud recipe={recipe} stage={stage} />
      )}

      {/* The brew is judged, never repeated. */}
      {finished && (
        <div className="scrim absolute inset-0 z-20 flex items-center justify-center p-6">
          <Sheet thick className="w-full max-w-md p-7">
            <div className="flex items-center gap-6">
              <ScoreRing
                value={finalMark}
                colour={markColour(finalMark)}
                caption="de 100"
              />
              <div className="min-w-0">
                <p className="t-caption uppercase tracking-[0.14em] text-label-3">
                  {recipe.name}
                </p>
                <h2 className="t-title mt-1">{grade(finalMark)}</h2>
                <p className="t-subhead mt-1 text-label-2">
                  Cinco etapas, cinco notas.
                </p>
              </div>
            </div>

            <ul className="mt-6 space-y-2.5">
              {recipe.stages.map((item, i) => {
                const mark = stage.marks[i] ?? 0;
                return (
                  <li key={item.id} className="flex items-center gap-3">
                    <span className="t-footnote w-28 shrink-0 text-label-2">
                      {item.title}
                    </span>
                    <Meter
                      value={mark}
                      colour={markColour(mark)}
                      className="flex-1"
                    />
                    <span className="t-footnote w-8 shrink-0 text-right font-mono text-label-3 tabular-nums">
                      {Math.round(mark * 100)}
                    </span>
                  </li>
                );
              })}
            </ul>

            <div className="mt-7 flex gap-3">
              <Button className="flex-1" onClick={() => startBrew(recipe)}>
                Otra vez
              </Button>
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => {
                  setPlaying(false);
                  setStage(null);
                }}
              >
                Cambiar de café
              </Button>
            </div>
          </Sheet>
        </div>
      )}

      {/* Three preparations, each with its own five stages. */}
      {!showGate && !playing && (
        <div className="scrim absolute inset-0 z-20 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-8 p-6 pt-24 sm:p-10 sm:pt-10">
            <header className="text-center">
              <h1 className="t-large-title">¿Qué preparamos?</h1>
              <p className="t-body mx-auto mt-3 max-w-md text-label-2">
                Cada café se prepara distinto. No hay etapas que repetir: lo que
                hagas en cada una cuenta para la nota final.
              </p>
            </header>

            <div className="grid gap-3 sm:grid-cols-3">
              {RECIPES.map((item) => (
                <RecipeCard key={item.id} recipe={item} onPick={startBrew} />
              ))}
            </div>

            <p className="t-footnote text-center text-label-3">
              Pellizca con pulgar e índice para tomar. Abre la mano y la etapa se
              cierra con el puntaje que lleves.
            </p>
          </div>
        </div>
      )}

      {showGate && (
        <div className="scrim absolute inset-0 z-30 flex items-center justify-center p-6">
          <Sheet className="w-full max-w-md p-8 text-center">
            <span
              className="squircle mx-auto flex h-16 w-16 items-center justify-center rounded-tile bg-tint text-tint-ink"
              aria-hidden
            >
              <CupGlyph className="h-8 w-8" />
            </span>
            <h1 className="t-large-title mt-5">Café a mano</h1>
            <p className="t-body mt-3 text-label-2">
              {loading
                ? "Cámara lista. Cargando el modelo de seguimiento…"
                : "Prepara café con las manos. Activa la cámara para empezar — el navegador te pedirá permiso."}
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
            <p className="t-footnote mt-6 text-label-3">
              El seguimiento corre en tu navegador. No se sube nada.
            </p>
          </Sheet>
        </div>
      )}
    </div>
  );
}
