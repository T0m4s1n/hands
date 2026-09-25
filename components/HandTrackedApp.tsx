"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { StageStatus } from "@/components/CoffeeGame";
import { RECIPES, type Recipe } from "@/components/coffee/recipes";
import { Meter } from "@/components/ui";
import { useHandTracking } from "@/hooks/useHandTracking";
import { Briefing } from "@/components/flow/Briefing";
import { CameraGate } from "@/components/flow/CameraGate";
import { Countdown } from "@/components/flow/Countdown";
import { HandSync } from "@/components/flow/HandSync";
import { IrisWipe, useIris } from "@/components/flow/IrisWipe";
import { RecipeMenu } from "@/components/flow/RecipeMenu";
import { Results } from "@/components/flow/Results";
import { LiveCup } from "@/components/flow/LiveCup";
import { handView } from "@/hooks/handPose";
import {
  ambienceForPhase,
  musicForPhase,
  phasePolicy,
  type AppPhase,
} from "@/components/flow/phasePolicy";
import { setAmbience, setMusic, setWorkLoop, unlockAudio } from "@/lib/audio";
import { markColour, stagePrompt } from "@/components/flow/playCopy";

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
/* ---------- pieces ---------- */

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
    <ol className="flex gap-2.5 sm:gap-3">
      {recipe.stages.map((stage, i) => {
        const mark = marks[i];
        const here = i === current;
        const done = mark !== undefined;
        return (
          <li
            key={stage.id}
            className={`flex min-w-0 flex-1 flex-col items-center gap-1.5 ${
              here ? "hud-step-here" : ""
            }`}
          >
            <span
              className={`text-float flex h-9 w-9 items-center justify-center rounded-full font-sans text-[0.8125rem] font-bold tabular-nums transition-[background-color,color,box-shadow] duration-300 ease-sheet sm:h-10 sm:w-10 sm:text-[0.875rem] ${
                here
                  ? "bg-tint text-tint-ink shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-tint)_32%,transparent)]"
                  : done
                    ? "text-tint-ink"
                    : "bg-black/35 text-label-2 ring-1 ring-white/15"
              }`}
              style={
                done && !here
                  ? { background: markColour(mark) }
                  : undefined
              }
              aria-current={here ? "step" : undefined}
            >
              {done && !here ? Math.round(mark * 100) : i + 1}
            </span>
            <p
              className={`text-float w-full truncate text-center font-sans text-[0.75rem] leading-tight sm:text-[0.8125rem] ${
                here ? "font-bold text-cream" : "font-medium text-label-2"
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

/** Floating HUD — no glass card; type + soft text shadows over the scene. */
function StageHud({
  recipe,
  stage,
  pointerMode,
}: {
  recipe: Recipe;
  stage: StageStatus;
  pointerMode: boolean;
}) {
  const current = recipe.stages[stage.index];
  const prompt = stagePrompt({
    kind: current?.kind,
    sits: current?.sits,
    near: stage.near,
    holding: stage.holding,
    working: stage.working,
    hurry: stage.hurry,
    pointer: pointerMode,
  });

  const promptTone = stage.hurry
    ? "text-[hsl(18_95%_68%)]"
    : stage.near && !stage.holding
      ? "text-tint"
      : "text-cream";

  const brewFill =
    (stage.marks.reduce((sum, m) => sum + m, 0) + stage.progress) /
    Math.max(stage.total, 1);

  return (
    <div className="pointer-events-none absolute left-0 top-0 z-10 w-[min(100%,32rem)] p-5 sm:p-6 lg:p-8">
      <div
        key={stage.index}
        className="hud-stage font-sans"
      >
        <div className="min-w-0" role="status" aria-live="polite">
          <p className="text-float text-[0.75rem] font-bold uppercase tracking-[0.22em] text-tint sm:text-[0.8125rem]">
            {recipe.name}
            <span className="mx-2 text-tint/45" aria-hidden>
              ·
            </span>
            <span className="tabular-nums">
              Paso {stage.index + 1} de {stage.total}
            </span>
          </p>
          <h2 className="text-hero mt-2 text-[clamp(2.15rem,5.5vw,3.15rem)] font-black leading-[0.92] tracking-[-0.045em] text-cream">
            {stage.title}
          </h2>
          <p
            className={`text-float mt-3 max-w-md text-balance text-[clamp(1.05rem,2.2vw,1.2rem)] font-semibold leading-snug ${promptTone}`}
          >
            {prompt}
          </p>
        </div>

        <div className="mt-5 max-w-sm">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="text-float text-[0.6875rem] font-bold uppercase tracking-[0.18em] text-label-3">
              Avance
            </span>
            <span className="text-float text-[0.8125rem] font-semibold tabular-nums text-cream/85">
              {stage.detail}
            </span>
          </div>
          <Meter
            value={stage.progress}
            colour={markColour(stage.quality)}
            className="h-2.5"
          />
        </div>

        <div className="mt-5 max-w-md">
          <Scorecard
            recipe={recipe}
            marks={stage.marks}
            current={stage.index}
          />
        </div>
      </div>

      <div className="hud-stage fixed bottom-6 right-6 sm:bottom-8 sm:right-8">
        <LiveCup
          fill={brewFill}
          quality={stage.quality}
          holding={stage.holding}
          hurry={stage.hurry}
          working={stage.working}
        />
      </div>
    </div>
  );
}

/* ---------- screen ---------- */

export function HandTrackedApp() {
  const {
    videoRef,
    handsRef,
    status,
    start,
    enablePointerFallback,
    inputMode,
  } = useHandTracking();
  const [stage, setStage] = useState<StageStatus | null>(null);
  const [recipe, setRecipe] = useState<Recipe>(RECIPES[0]);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<AppPhase>("sync");
  const { closed, go } = useIris();

  useEffect(() => {
    // The hand lab exposes this mutable tuning switch. Client-side navigation
    // must never carry a lab experiment into the actual game.
    handView.faceDorsal = false;
  }, []);

  useEffect(() => {
    const wake = () => unlockAudio();
    window.addEventListener("pointerdown", wake);
    window.addEventListener("keydown", wake);
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  const showGate = status !== "ready" && phase === "sync";
  const loading = status === "loading-model";
  const playing = phase === "play";
  const policy = phasePolicy(phase);

  useEffect(() => {
    setMusic(musicForPhase(phase));
    setAmbience(showGate ? 0.18 : ambienceForPhase(phase));
    if (phase !== "play") setWorkLoop(null);
  }, [phase, showGate]);

  const toMenu = useCallback(() => {
    void go(() => setPhase("menu"));
  }, [go]);

  const playWithMouse = useCallback(() => {
    setPhase("menu");
    try {
      enablePointerFallback();
    } catch (err) {
      console.error("pointer fallback failed", err);
    }
  }, [enablePointerFallback]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("raton") === "1" || params.get("mouse") === "1") {
      playWithMouse();
    }
  }, [playWithMouse]);

  const pickRecipe = useCallback(
    (next: Recipe) => {
      void go(() => {
        setRecipe(next);
        setStage(null);
        setPhase("brief");
      });
    },
    [go],
  );

  const toCount = useCallback(() => {
    void go(() => {
      setStage(null);
      setRound((value) => value + 1);
      setPhase("count");
    });
  }, [go]);

  const toPlay = useCallback(() => {
    setPhase("play");
  }, []);

  const toResults = useCallback(() => {
    void go(() => setPhase("results"));
  }, [go]);

  useEffect(() => {
    if (phase === "play" && stage?.done) toResults();
  }, [phase, stage?.done, toResults]);

  const scene = useMemo(
    () => (
      <HandTrackedScene
        recipe={recipe}
        handsRef={handsRef}
        onStatus={setStage}
        round={round}
        running={policy.acceptGameplayInput}
        showHands={policy.showHands}
        showGuides={policy.showGameplayGuides}
      />
    ),
    [
      recipe,
      handsRef,
      round,
      policy.acceptGameplayInput,
      policy.showHands,
      policy.showGameplayGuides,
    ],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas text-label">
      {/* Tracking still needs a mounted video, but production UI has no
          diagnostics panel or shader controls. */}
      <video
        ref={videoRef}
        className="pointer-events-none absolute h-px w-px opacity-0"
        autoPlay
        muted
        playsInline
        aria-hidden
      />
      <div className="absolute inset-0">{scene}</div>

      {playing && stage && !stage.done && (
        <StageHud
          recipe={recipe}
          stage={stage}
          pointerMode={inputMode === "pointer"}
        />
      )}

      {!showGate && phase === "sync" && (
        <HandSync
          handsRef={handsRef}
          onReady={toMenu}
          onPointerFallback={playWithMouse}
        />
      )}
      {!showGate && phase === "menu" && (
        <RecipeMenu handsRef={handsRef} onPick={pickRecipe} />
      )}
      {!showGate && phase === "brief" && (
        <Briefing recipe={recipe} onSkip={toCount} onDone={toCount} />
      )}
      {!showGate && phase === "count" && <Countdown onDone={toPlay} />}
      {!showGate && phase === "results" && stage && (
        <Results
          recipe={recipe}
          marks={stage.marks}
          onReplay={toCount}
          onChange={toMenu}
        />
      )}

      <IrisWipe closed={closed} />

      {showGate && (
        <CameraGate
          loading={loading}
          onStream={(stream) => void start(stream)}
          onPointerFallback={playWithMouse}
        />
      )}
    </div>
  );
}
