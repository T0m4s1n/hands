"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui";
import type { Recipe } from "@/components/coffee/recipes";
import { KIND_VERB } from "@/components/flow/playCopy";
import { playSfx } from "@/lib/audio";

/**
 * Floating tutorial — no cards, no glass sheets.
 * Tailwind + shared `.text-float` / `.text-hero` shadows from globals.css.
 */

type Act = "gesto" | "receta" | "listo";

const ACTS: readonly Act[] = ["gesto", "receta", "listo"];
const GESTO_MS = 5200;
const RECETA_MS = 10000;
const LISTO_MS = 4200;


const ACT_TITLE: Record<Act, string> = {
  gesto: "Así se toman las cosas",
  receta: "Tu café, paso a paso",
  listo: "Una pasada por etapa",
};

export function Briefing({
  recipe,
  onSkip,
  onDone,
}: {
  recipe: Recipe;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [armed, setArmed] = useState(false);
  const [act, setAct] = useState<Act>("gesto");
  const index = ACTS.indexOf(act);
  const last = index >= ACTS.length - 1;

  const advance = useCallback(() => {
    if (!armed) return;
    playSfx(last ? "confirm" : "click");
    if (last) onDone();
    else setAct(ACTS[index + 1]);
  }, [armed, last, index, onDone]);

  useEffect(() => {
    const arm = window.setTimeout(() => setArmed(true), 400);
    return () => window.clearTimeout(arm);
  }, []);

  useEffect(() => {
    playSfx("page");
  }, [act]);

  useEffect(() => {
    if (!armed) return;
    const wait =
      act === "gesto" ? GESTO_MS : act === "receta" ? RECETA_MS : LISTO_MS;
    const id = window.setTimeout(advance, wait);
    return () => window.clearTimeout(id);
  }, [armed, act, advance]);

  return (
    <div className="absolute inset-0 z-20 flex flex-col overflow-hidden font-sans">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgb(10_2_5/0.35)_0%,rgb(10_2_5/0.72)_55%,rgb(8_1_4/0.9)_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0c0206]/55 via-transparent to-[#0c0206]/80"
      />

      <header className="brief-float relative z-10 flex items-start justify-between gap-4 px-6 pt-7 [@media(max-height:700px)]:pt-4 sm:px-10 sm:pt-9 lg:px-14">
        <div className="min-w-0">
          <p className="text-float text-[0.75rem] font-bold uppercase tracking-[0.24em] text-tint sm:text-[0.8125rem]">
            Antes de {recipe.name}
          </p>
          <h1
            key={act}
            className="brief-act text-hero mt-2 max-w-xl text-[clamp(1.55rem,3.6vw,2.15rem)] font-black leading-[1.05] tracking-[-0.04em] text-cream"
          >
            {ACT_TITLE[act]}
          </h1>
        </div>
        <ol
          className="flex shrink-0 items-center gap-2 pt-1"
          aria-label="Pasos del tutorial"
        >
          {ACTS.map((id, i) => (
            <li key={id}>
              <button
                type="button"
                disabled={!armed || i > index}
                aria-current={i === index ? "step" : undefined}
                aria-label={`Paso ${i + 1}`}
                onClick={() => {
                  if (!armed || i > index) return;
                  playSfx("select");
                  if (i === index) advance();
                  else setAct(ACTS[i]);
                }}
                className={`h-2.5 rounded-full transition-[width,background-color,box-shadow] duration-300 ease-sheet ${
                  i === index
                    ? "w-9 bg-tint shadow-[0_0_16px_color-mix(in_srgb,var(--color-tint)_55%,transparent)]"
                    : i < index
                      ? "w-2.5 bg-tint/70 hover:bg-tint"
                      : "w-2.5 bg-white/20"
                } disabled:pointer-events-none`}
              />
            </li>
          ))}
        </ol>
      </header>

      <div className="relative flex flex-1 flex-col items-center justify-center px-5 py-5 [@media(max-height:700px)]:py-2 sm:px-8">
        {act === "gesto" && <GestoAct key="gesto" />}
        {act === "receta" && <RecetaAct key="receta" recipe={recipe} />}
        {act === "listo" && (
          <ListoAct key="listo" stages={recipe.stages.length} />
        )}
      </div>

      <footer className="brief-float delay-160 relative z-10 flex flex-wrap items-center justify-center gap-3 px-6 pb-8 [@media(max-height:700px)]:pb-3 sm:pb-10">
        <Button
          disabled={!armed}
          onClick={advance}
          className="min-w-[9.5rem] text-[1rem] font-bold"
        >
          {last ? "Empezar" : "Siguiente"}
        </Button>
        <Button
          variant="plain"
          disabled={!armed}
          onClick={() => {
            playSfx("click");
            onSkip();
          }}
          className="min-w-[7.5rem]"
        >
          Saltar
        </Button>
      </footer>
    </div>
  );
}

function GestoAct() {
  return (
    <div className="brief-act flex w-full max-w-lg flex-col items-center text-center">
      <div className="relative mx-auto h-[13.5rem] w-full max-w-sm [@media(max-height:700px)]:h-36 sm:h-[15.5rem]">
        <GestureDemo />
      </div>
      <h2 className="text-hero mt-5 text-[clamp(2.5rem,8vw,3.75rem)] font-black leading-[0.9] tracking-[-0.045em] text-cream">
        Pellizca y lleva
      </h2>
      <p className="text-float mx-auto mt-4 max-w-md text-balance text-[clamp(1.05rem,2.4vw,1.2rem)] font-semibold leading-snug text-cream/90">
        Junta pulgar e índice sobre lo que brilla. Llévalo encima del molino,
        la taza o el plato y suelta — no hace falta dar en el centro.
      </p>
      <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
        {[
          { n: "1", label: "Pellizca", delay: "350ms" },
          { n: "2", label: "Lleva", delay: "1100ms" },
          { n: "3", label: "Suelta", delay: "1900ms" },
        ].map((step, i) => (
          <li key={step.n} className="flex items-center gap-2">
            {i > 0 && (
              <span aria-hidden className="text-float text-tint/60">
                →
              </span>
            )}
            <span
              className="brief-chip text-float inline-flex items-center gap-2 text-[0.9375rem] font-bold text-cream"
              style={{ animationDelay: step.delay }}
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tint text-[0.75rem] font-black text-tint-ink">
                {step.n}
              </span>
              {step.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function GestureDemo() {
  return (
    <svg
      viewBox="0 0 320 240"
      className="h-full w-full overflow-visible drop-shadow-[0_12px_28px_rgb(0_0_0/0.55)]"
      aria-hidden
    >
      <defs>
        <radialGradient id="gesture-target-glow" cx="50%" cy="40%" r="70%">
          <stop offset="0" stopColor="#f5990a" stopOpacity="0.42" />
          <stop offset="0.7" stopColor="#f5990a" stopOpacity="0.08" />
          <stop offset="1" stopColor="#f5990a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="gesture-glove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffaf3" />
          <stop offset="1" stopColor="#f0d8bc" />
        </linearGradient>
        <linearGradient id="gesture-cuff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffc56a" />
          <stop offset="1" stopColor="#e28a28" />
        </linearGradient>
        <linearGradient id="gesture-bowl" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8a5340" />
          <stop offset="1" stopColor="#4a2418" />
        </linearGradient>
        <linearGradient id="gesture-scoop" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff8ee" />
          <stop offset="1" stopColor="#e8c9a0" />
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="214" rx="118" ry="11" fill="#f5990a" opacity="0.1" />
      <path
        d="M34 206h252"
        stroke="#3d1206"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.35"
      />
      <path
        d="M40 200h240"
        stroke="#6b3a24"
        strokeWidth="6"
        strokeLinecap="round"
      />

      <path
        d="M118 112C158 64 214 62 250 108"
        fill="none"
        stroke="#f5990a"
        strokeWidth="2.4"
        strokeDasharray="2 9"
        strokeLinecap="round"
        opacity="0.55"
      />
      <path
        d="m244 100 12 8-14 4"
        fill="none"
        stroke="#f5990a"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.85"
      />

      <g transform="translate(248 148)">
        <g className="brief-ring">
          <ellipse rx="52" ry="22" fill="url(#gesture-target-glow)" />
          <ellipse cx="0" cy="10" rx="36" ry="10" fill="#1a0806" opacity="0.28" />
          <ellipse cx="0" cy="6" rx="34" ry="13" fill="url(#gesture-bowl)" />
          <ellipse
            cx="0"
            cy="-2"
            rx="34"
            ry="14"
            fill="#2b100c"
            stroke="#f5990a"
            strokeWidth="3"
          />
          <ellipse cx="0" cy="-4" rx="22" ry="8" fill="#5c2a18" />
          <circle cx="-6" cy="-3" r="2.1" fill="#3b1a10" />
          <circle cx="4" cy="-1" r="1.7" fill="#6b3318" />
          <circle cx="9" cy="-5" r="1.4" fill="#4a2210" />
        </g>
      </g>

      <g className="brief-scoop">
        <ellipse cx="18" cy="3" rx="16" ry="5" fill="#f0b429" opacity="0.28" />
        <path
          d="M16 1h22"
          stroke="#d4a36a"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M16 1h22"
          stroke="#3d1206"
          strokeWidth="1.6"
          strokeLinecap="round"
          opacity="0.35"
        />
        <ellipse
          cx="0"
          cy="0"
          rx="15"
          ry="11"
          fill="url(#gesture-scoop)"
          stroke="#3d1206"
          strokeWidth="2.2"
        />
        <ellipse cx="-1" cy="-2" rx="9" ry="5.5" fill="#c9844a" opacity="0.35" />
        <circle cx="-4" cy="-1" r="2.4" fill="#5c2a12" />
        <circle cx="3" cy="1" r="2" fill="#3b1a10" />
        <circle cx="1" cy="-3" r="1.6" fill="#8a4518" />
      </g>

      <g transform="translate(18 18) scale(0.92)">
        <g className="brief-hand">
          <g transform="rotate(-28 72 124)">
            <ellipse
              className="brief-thumb"
              cx="72"
              cy="124"
              rx="16"
              ry="24"
              fill="url(#gesture-glove)"
              stroke="#3d1206"
              strokeWidth="2.6"
            />
          </g>
          <g transform="rotate(28 168 92)">
            <ellipse
              cx="168"
              cy="92"
              rx="11"
              ry="23"
              fill="url(#gesture-glove)"
              stroke="#3d1206"
              strokeWidth="2.4"
            />
          </g>
          <g transform="rotate(14 148 74)">
            <ellipse
              cx="148"
              cy="74"
              rx="12"
              ry="28"
              fill="url(#gesture-glove)"
              stroke="#3d1206"
              strokeWidth="2.4"
            />
          </g>
          <ellipse
            cx="127"
            cy="68"
            rx="12.5"
            ry="30"
            fill="url(#gesture-glove)"
            stroke="#3d1206"
            strokeWidth="2.4"
          />
          <g transform="rotate(-8 104 76)">
            <ellipse
              className="brief-index"
              cx="104"
              cy="76"
              rx="13"
              ry="30"
              fill="url(#gesture-glove)"
              stroke="#3d1206"
              strokeWidth="2.6"
            />
          </g>
          <ellipse
            cx="108"
            cy="128"
            rx="42"
            ry="36"
            fill="url(#gesture-glove)"
            stroke="#3d1206"
            strokeWidth="2.8"
          />
          <path
            d="M84 154h48c6 0 12 6 12 14 0 12-12 20-36 20s-36-8-36-20c0-8 6-14 12-14Z"
            fill="url(#gesture-cuff)"
            stroke="#3d1206"
            strokeWidth="2.6"
          />
          <path
            d="M86 160c14 5 34 5 48 0"
            fill="none"
            stroke="#fff1d8"
            strokeWidth="2.8"
            strokeLinecap="round"
            opacity="0.75"
          />
          <circle cx="94" cy="120" r="3.1" fill="#3d1206" />
          <circle cx="118" cy="120" r="3.1" fill="#3d1206" />
          <circle cx="95.2" cy="118.8" r="1" fill="#fff6ea" />
          <circle cx="119.2" cy="118.8" r="1" fill="#fff6ea" />
          <ellipse cx="90" cy="132" rx="7" ry="4" fill="#f3b3a0" opacity="0.45" />
          <ellipse cx="122" cy="132" rx="7" ry="4" fill="#f3b3a0" opacity="0.45" />
          <path
            d="M98 138c6 7 14 7 20 0"
            fill="none"
            stroke="#3d1206"
            strokeWidth="2.6"
            strokeLinecap="round"
          />
        </g>
      </g>

      <g className="brief-spark" fill="#ffd27f" transform="translate(108 84)">
        <path d="M0-9 2.4 6.4H9.4L3.8 1.6 5.8 8.4 0 4.6l-5.8 3.8 2-6.8-5.6-4.8h7Z" />
      </g>
    </svg>
  );
}

function RecetaAct({ recipe }: { recipe: Recipe }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setStep((value) => (value + 1) % recipe.stages.length),
      1750,
    );
    return () => window.clearInterval(id);
  }, [recipe.stages.length]);

  const stage = recipe.stages[step];

  return (
    <div className="brief-act w-full max-w-xl text-center sm:max-w-2xl">
      <p className="text-float text-[0.75rem] font-bold uppercase tracking-[0.22em] text-tint">
        {recipe.name} · {recipe.stages.length} pasos
      </p>
      <h2 className="text-hero mt-2 text-[clamp(2rem,5vw,2.75rem)] font-black leading-[1.02] tracking-[-0.04em] text-cream">
        Así se prepara
      </h2>
      <p className="text-float mx-auto mt-3 max-w-md text-[1rem] font-semibold leading-snug text-cream/85">
        {recipe.blurb}
      </p>
      <div
        key={stage.id}
        className="brief-stage mx-auto mt-7 flex min-h-56 max-w-lg flex-col items-center justify-center [@media(max-height:700px)]:mt-3 [@media(max-height:700px)]:min-h-40"
      >
        <span className="text-float text-[4.75rem] font-black leading-none tabular-nums text-tint">
          {String(step + 1).padStart(2, "0")}
        </span>
        <p className="text-float mt-3 text-[0.8125rem] font-black uppercase tracking-[0.22em] text-tint">
          {KIND_VERB[stage.kind]}
        </p>
        <h3 className="text-hero mt-1 text-[clamp(2.25rem,6vw,3.5rem)] font-black leading-none tracking-[-0.045em] text-cream">
          {stage.title}
        </h3>
        <p className="text-float mt-4 max-w-md text-balance text-[clamp(1.05rem,2.4vw,1.2rem)] font-semibold leading-snug text-cream/90">
          {stage.instruction}
        </p>
      </div>

      <ol className="mt-6 flex items-center justify-center gap-2.5" aria-label="Pasos de la receta">
        {recipe.stages.map((item, i) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setStep(i)}
              aria-label={`Ver ${item.title}`}
              aria-current={i === step ? "step" : undefined}
              className={`h-3 rounded-full transition-all duration-300 ${
                i === step
                  ? "w-10 bg-tint shadow-[0_0_16px_rgb(245_153_10/0.5)]"
                  : "w-3 bg-white/25 hover:bg-white/45"
              }`}
            />
          </li>
        ))}
      </ol>

      <p className="text-float mt-5 text-[0.75rem] font-bold uppercase tracking-[0.16em] text-tint">
        La ilustración enseña el gesto. Tus manos mueven el café.
      </p>
    </div>
  );
}

function ListoAct({ stages }: { stages: number }) {
  return (
    <div className="brief-act flex max-w-md flex-col items-center text-center">
      <div className="brief-once-mark relative mb-7 flex h-28 w-28 items-center justify-center [@media(max-height:700px)]:mb-3 [@media(max-height:700px)]:h-20 [@media(max-height:700px)]:w-20">
        <span aria-hidden className="absolute inset-0 rounded-full bg-tint/30 blur-md" />
        <span
          aria-hidden
          className="brief-once-ring absolute inset-1 rounded-full border-[2.5px] border-tint"
        />
        <span className="relative text-[3.25rem] font-black leading-none text-tint [text-shadow:0_4px_0_color-mix(in_srgb,var(--color-tint)_35%,black)]">
          1
        </span>
      </div>
      <h2 className="text-hero text-[clamp(2.5rem,8vw,3.75rem)] font-black leading-[0.9] tracking-[-0.045em] text-cream [@media(max-height:700px)]:text-[2.5rem]">
        Sin repetir
      </h2>
      <p className="text-float mt-4 max-w-sm text-balance text-[clamp(1.1rem,2.5vw,1.25rem)] font-semibold leading-snug text-cream/90 [@media(max-height:700px)]:mt-2 [@media(max-height:700px)]:text-base">
        Cada etapa se juega una sola vez. Si sale torpe, sigue — solo que con
        peor café al final.
      </p>
      <p className="text-float mt-7 text-[0.8125rem] font-bold uppercase tracking-[0.2em] text-tint [@media(max-height:700px)]:mt-3">
        {stages} gestos · Una taza
      </p>
    </div>
  );
}
