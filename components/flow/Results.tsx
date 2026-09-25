"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Button, Meter } from "@/components/ui";
import {
  grade,
  recipeHero,
  stars,
  type Recipe,
} from "@/components/coffee/recipes";
import { markColour, stageSummary } from "@/components/flow/playCopy";
import { LiveCup } from "@/components/flow/LiveCup";
import { playSfx } from "@/lib/audio";

function average(marks: readonly number[]): number {
  if (marks.length === 0) return 0;
  return marks.reduce((sum, mark) => sum + mark, 0) / marks.length;
}

function verdict(word: string): string {
  switch (word) {
    case "Excelente":
      return "Esta taza se puede servir con orgullo.";
    case "Muy bueno":
      return "Casi de casa. Un detalle y queda redonda.";
    case "Correcto":
      return "Se bebe. La próxima sale más limpia.";
    case "Mejorable":
      return "Hay café, pero le faltó pulso.";
    default:
      return "Mejor pedir otra ronda.";
  }
}

export function Results({
  recipe,
  marks,
  onReplay,
  onChange,
}: {
  recipe: Recipe;
  marks: readonly number[];
  onReplay: () => void;
  onChange: () => void;
}) {
  const total = average(marks);
  const word = grade(total);
  const best = marks.reduce(
    (winner, mark, i) => (mark > (marks[winner] ?? -1) ? i : winner),
    0,
  );

  useEffect(() => {
    playSfx("win");
  }, []);

  return (
    <div className="absolute inset-0 z-20 overflow-y-auto overflow-x-hidden font-sans">
      <Image
        src={recipeHero(recipe.id)}
        alt=""
        fill
        sizes="100vw"
        priority
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-canvas/94 via-canvas/62 to-canvas/28"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-canvas/85 via-transparent to-canvas/35"
      />

      <div className="recipe-menu-ui relative z-10 mx-auto grid min-h-full w-full max-w-6xl grid-cols-1 content-between gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[minmax(0,1fr)_20.5rem] lg:items-end lg:gap-12 lg:px-16 lg:pb-12 lg:pt-16">
        <div className="min-w-0">
          <p className="text-float t-caption uppercase tracking-[0.2em] text-tint">
            La reseña
          </p>
          <h1 className="text-hero mt-1.5 text-[clamp(2.4rem,7vw,4.6rem)] font-black leading-[0.88] tracking-[-0.045em] text-cream">
            {word}
          </h1>
          <p className="text-float mt-2.5 max-w-lg text-[clamp(1.05rem,2.1vw,1.3rem)] font-semibold leading-snug text-cream">
            {recipe.name}
            <span className="text-label-2"> · {verdict(word)}</span>
          </p>

          <ol className="mt-6 flex flex-col">
            {recipe.stages.map((stage, i) => {
              const mark = marks[i] ?? 0;
              const on = i === best;
              return (
                <li
                  key={stage.id}
                  className="brief-stage py-2"
                  style={{ animationDelay: `${100 + i * 70}ms` }}
                >
                  <div className="flex items-baseline gap-3 sm:gap-4">
                    <span
                      className={`t-footnote w-6 shrink-0 font-sans tabular-nums ${on ? "text-tint" : "text-cream/35"}`}
                    >
                      0{i + 1}
                    </span>
                    <p
                      className={`min-w-0 flex-1 font-black leading-[0.92] tracking-[-0.04em] ${
                        on
                          ? "text-hero text-[clamp(1.55rem,3.6vw,2.45rem)] text-cream"
                          : "text-float text-[clamp(1.2rem,2.6vw,1.75rem)] text-cream/42"
                      }`}
                    >
                      {stage.title}
                    </p>
                    <span
                      className={`shrink-0 tabular-nums text-[0.95rem] font-bold ${on ? "text-tint" : "text-cream/50"}`}
                    >
                      {Math.round(mark * 100)}
                    </span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3 pl-9 sm:pl-10">
                    <p className="text-float hidden min-w-0 flex-1 truncate text-[0.875rem] font-medium text-label-2 sm:block">
                      {stageSummary(stage.kind, stage.sits)}
                    </p>
                    <Stars value={stars(mark)} colour={markColour(mark)} />
                  </div>
                  <Meter
                    value={mark}
                    colour={markColour(mark)}
                    className="result-bar ml-9 mt-2 h-[3px] w-40 bg-white/15 sm:ml-10"
                  />
                </li>
              );
            })}
          </ol>
        </div>

        <aside className="relative w-full pb-4 lg:pb-0">
          <p className="text-float t-caption uppercase tracking-[0.18em] text-tint">
            {recipe.name}
          </p>
          <p className="text-float mt-2.5 text-[clamp(1rem,1.8vw,1.25rem)] font-medium leading-snug tracking-tight text-cream">
            {recipe.pitch}
          </p>
          <Ticket recipe={recipe} marks={marks} total={total} word={word} />
          <div className="mt-5 flex gap-3">
            <Button
              className="flex-1"
              onClick={() => {
                playSfx("confirm");
                onReplay();
              }}
            >
              Otra vez
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                playSfx("switch");
                onChange();
              }}
            >
              Cambiar de café
            </Button>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Ticket({
  recipe,
  marks,
  total,
  word,
}: {
  recipe: Recipe;
  marks: readonly number[];
  total: number;
  word: string;
}) {
  return (
    <div className="relative mt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-2 -top-9 hidden lg:block"
      >
        <LiveCup
          fill={Math.max(0.35, total)}
          quality={total}
          holding={false}
          hurry={false}
          working={total >= 0.6}
          className="h-[4.6rem] w-16"
        />
      </div>
      <div className="result-ticket relative z-10 bg-cream px-5 py-5 text-cocoa shadow-[0_22px_50px_rgb(0_0_0/0.45)]">
        <p className="text-center text-[0.65rem] font-bold uppercase tracking-[0.22em] text-wine">
          La Mejor Taza
        </p>
        <p className="mt-1 text-center text-[0.7rem] tracking-wide text-cocoa/65">
          {recipe.name} · mesa 1
        </p>
        <div className="relative mx-auto mt-3 flex h-[5.5rem] w-[5.5rem] items-center justify-center">
          <svg viewBox="0 0 96 96" className="absolute inset-0" aria-hidden>
            <circle
              cx="48"
              cy="48"
              r="42"
              fill="none"
              stroke="var(--color-wine)"
              strokeWidth="2.2"
              strokeDasharray="4 5"
              opacity="0.45"
            />
            <circle
              cx="48"
              cy="48"
              r="36"
              fill="none"
              stroke="var(--color-wine)"
              strokeWidth="1.4"
              opacity="0.7"
            />
          </svg>
          <div className="text-center">
            <p className="text-[1.7rem] font-black leading-none tracking-[-0.04em] text-wine">
              {Math.round(total * 100)}
            </p>
            <p className="mt-0.5 text-[0.58rem] font-bold uppercase tracking-[0.16em] text-wine/70">
              total
            </p>
          </div>
        </div>
        <Dash />
        <ul className="space-y-1 text-[0.78rem] font-semibold">
          {recipe.stages.map((stage, i) => (
            <li key={stage.id} className="flex items-center justify-between gap-3">
              <span>{stage.title}</span>
              <span className="tabular-nums">
                {String(Math.round((marks[i] ?? 0) * 100)).padStart(3, " ")}
              </span>
            </li>
          ))}
        </ul>
        <Dash />
        <p className="text-center text-[0.78rem] font-black uppercase tracking-[0.16em] text-wine">
          {word}
        </p>
        <p className="mt-1.5 text-center text-[0.65rem] tracking-wide text-cocoa/55">
          Cinco etapas. Ninguna se repite.
        </p>
      </div>
    </div>
  );
}

function Dash() {
  return (
    <div
      className="my-2.5 border-t border-dashed border-cocoa/25"
      aria-hidden
    />
  );
}

function Stars({ value, colour }: { value: number; colour: string }) {
  return (
    <span className="flex shrink-0 gap-0.5" aria-label={`${value} de 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
          <path
            d="M8 1.4 9.9 5.7l4.6.4-3.5 3 1.1 4.5L8 11.4l-4.1 2.2 1.1-4.5-3.5-3 4.6-.4Z"
            fill={i < value ? colour : "rgb(255 250 244 / 0.22)"}
          />
        </svg>
      ))}
    </span>
  );
}
