"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import Image from "next/image";
import {
  RECIPES,
  recipeHero,
  type Recipe,
} from "@/components/coffee/recipes";
import type { TrackedHand } from "@/hooks/useHandTracking";
import { useHandCursor, type HandCursor } from "./useHandCursor";
import {
  canDwellSelect,
  canPinchSelect,
  menuHoldAmount,
} from "./menuInput";
import { playSfx, preloadSfx, unlockAudio } from "@/lib/audio";

/**
 * The carta — driven almost entirely through the DOM.
 *
 * PROTECTED — do not “simplify” or redesign away these contracts:
 * 1. `useHandCursor` + `menuAimPoint` / `screenFromHand` (camera tip OR mouse).
 * 2. Reticle updated via DOM (`translate3d`), never React setState per frame.
 * 3. Focus via `data-focus` / `data-on` CSS (scale names, hero crossfade, charge).
 * 4. Hit targets = whole `[data-recipe-opt]` row, remasured every frame.
 * 5. Sticky one-hand lock; hold-to-pick + pinch edge + mouse click.
 *
 * Visual polish is fine; breaking the pointer or the CSS focus machine is not.
 */
export function RecipeMenu({
  handsRef,
  onPick,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onPick: (recipe: Recipe) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const pickedRef = useRef(false);
  const holdRef = useRef({ index: -1, started: 0 });
  const wasGrabbing = useRef(false);
  const lockSideRef = useRef<HandCursor["handedness"]>(null);
  const focusRef = useRef(0);
  const boxesRef = useRef<{ i: number; left: number; right: number; top: number; bottom: number }[]>(
    [],
  );

  const pick = useCallback(
    (recipe: Recipe) => {
      if (pickedRef.current) return;
      // Mark only after we invoke the parent — if the iris is still busy the
      // parent may no-op; a short reset below recovers so the carta never sticks.
      pickedRef.current = true;
      onPick(recipe);
      window.setTimeout(() => {
        // Still mounted on the menu → pick did not navigate; allow retry.
        if (rootRef.current) pickedRef.current = false;
      }, 1600);
    },
    [onPick],
  );

  const measureHits = useCallback(() => {
    const root = listRef.current;
    if (!root) return;
    // Whole option row — the name alone was too small once blurbs open/close.
    const targets = root.querySelectorAll<HTMLElement>("[data-recipe-opt]");
    const padX = 24;
    const padY = 10;
    boxesRef.current = Array.from(targets).map((el, i) => {
      const box = el.getBoundingClientRect();
      return {
        i,
        left: box.left - padX,
        right: box.right + padX,
        top: box.top - padY,
        bottom: box.bottom + padY,
      };
    });
  }, []);

  const applyFocus = useCallback(
    (index: number) => {
      if (
        focusRef.current === index &&
        rootRef.current?.dataset.focus === String(index)
      ) {
        return;
      }
      focusRef.current = index;
      const root = rootRef.current;
      if (!root) return;
      playSfx("select");
      root.dataset.focus = String(index);
      root.querySelectorAll<HTMLElement>("[data-recipe-opt]").forEach((el) => {
        if (el.dataset.i === String(index)) el.dataset.on = "";
        else delete el.dataset.on;
      });
    },
    [],
  );

  const setCharge = useCallback((index: number, amount: number) => {
    const root = listRef.current;
    if (!root) return;
    const bars = root.querySelectorAll<HTMLElement>("[data-charge]");
    for (const el of bars) {
      const i = Number(el.dataset.charge);
      const value = i === index ? Math.round(amount * 50) / 50 : 0;
      if (el.dataset.amt === String(value)) continue;
      el.dataset.amt = String(value);
      el.style.transform = `scaleX(${value})`;
    }
  }, []);

  const onFrame = useCallback(
    (cursor: HandCursor) => {
      const dot = pointerRef.current;
      if (dot) {
        // translate3d stays on the compositor; left/top % was layout-bound.
        const x = cursor.x * window.innerWidth;
        const y = cursor.y * window.innerHeight;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
        dot.style.opacity = cursor.active ? "1" : "0";
        dot.dataset.grabbing = cursor.grabbing ? "1" : "0";
      }

      if (hintRef.current) {
        hintRef.current.style.opacity = cursor.active ? "0" : "1";
      }

      // New lock (or lost lock) must not finish a charge started by the other hand.
      if (cursor.handedness !== lockSideRef.current) {
        lockSideRef.current = cursor.handedness;
        holdRef.current = { index: -1, started: 0 };
        setCharge(focusRef.current, 0);
        wasGrabbing.current = false;
      }

      if (!cursor.active) {
        if (holdRef.current.index !== -1) {
          holdRef.current.index = -1;
          setCharge(focusRef.current, 0);
        }
        wasGrabbing.current = cursor.grabbing;
        return;
      }

      // Three rects is cheap; remeasure every frame so scale/blurb never
      // leave the hit boxes a frame behind the layout.
      measureHits();

      const x = cursor.x * window.innerWidth;
      const y = cursor.y * window.innerHeight;
      let next = -1;
      for (const box of boxesRef.current) {
        if (
          x >= box.left &&
          x <= box.right &&
          y >= box.top &&
          y <= box.bottom
        ) {
          next = box.i;
          break;
        }
      }

      if (next >= 0) applyFocus(next);

      const owner = cursor.handedness
        ? (handsRef.current ?? []).find(
            (hand) => hand.handedness === cursor.handedness,
          )
        : undefined;
      const pointerMode = Boolean(owner && !canDwellSelect(owner));

      if (next >= 0 && !pointerMode) {
        if (holdRef.current.index !== next) {
          holdRef.current = { index: next, started: performance.now() };
          setCharge(next, 0);
        } else {
          const amount = menuHoldAmount(
            performance.now() - holdRef.current.started,
          );
          setCharge(next, amount);
          if (amount >= 1) pick(RECIPES[next]);
        }
      } else if (holdRef.current.index !== -1) {
        holdRef.current.index = -1;
        setCharge(focusRef.current, 0);
      }

      const edge = cursor.grabbing && !wasGrabbing.current;
      wasGrabbing.current = cursor.grabbing;
      const hoveredMs =
        holdRef.current.index === next && next >= 0
          ? performance.now() - holdRef.current.started
          : 0;
      if (edge && next >= 0 && canPinchSelect(hoveredMs)) {
        pick(RECIPES[next]);
      }
    },
    [applyFocus, handsRef, measureHits, pick, setCharge],
  );

  useHandCursor(handsRef, onFrame);

  useEffect(() => {
    applyFocus(0);
    measureHits();
    preloadSfx();
    unlockAudio();
    const onResize = () => measureHits();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [applyFocus, measureHits]);

  // Native mouse path — only when no camera hand is aiming, so the two
  // pointers never fight. Guarantees the carta works with a mouse alone.
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const hands = handsRef.current ?? [];
      const cameraLive = hands.some(
        (hand) => hand.smoothedLandmarks.length >= 9,
      );
      if (cameraLive) return;

      const dot = pointerRef.current;
      if (dot) {
        dot.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;
        dot.style.opacity = "1";
      }
      if (hintRef.current) hintRef.current.style.opacity = "0";
      measureHits();
      let next = -1;
      for (const box of boxesRef.current) {
        if (
          event.clientX >= box.left &&
          event.clientX <= box.right &&
          event.clientY >= box.top &&
          event.clientY <= box.bottom
        ) {
          next = box.i;
          break;
        }
      }
      if (next >= 0) applyFocus(next);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [applyFocus, handsRef, measureHits]);

  return (
    <div
      ref={rootRef}
      data-focus="0"
      className="recipe-menu pointer-events-auto absolute inset-0 z-20 overflow-hidden"
    >
      {RECIPES.map((item, i) => (
        <Image
          key={item.id}
          src={recipeHero(item.id)}
          alt=""
          fill
          sizes="100vw"
          priority={i === 0}
          data-i={i}
          className="recipe-hero absolute inset-0 h-full w-full object-cover"
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-r from-canvas/92 via-canvas/55 to-canvas/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-canvas/70 via-transparent to-canvas/25" />

      <div className="recipe-menu-ui relative flex h-full flex-col justify-between px-6 py-16 sm:flex-row sm:items-end sm:px-10 sm:pb-16 sm:pt-20 lg:px-16 lg:pb-20 lg:pt-24">
        <div className="max-w-xl">
          <p className="t-caption uppercase tracking-[0.2em] text-tint">
            La carta
          </p>
          <p className="mt-2 text-[clamp(1.4rem,3.4vw,2.25rem)] font-semibold tracking-tight text-label-2">
            ¿Qué pedimos?
          </p>

          <div ref={listRef} className="mt-8 flex flex-col">
            {RECIPES.map((item, i) => (
              <button
                key={item.id}
                type="button"
                data-recipe-opt
                data-i={i}
                {...(i === 0 ? { "data-on": "" } : {})}
                onMouseEnter={() => {
                  applyFocus(i);
                  holdRef.current = { index: i, started: performance.now() };
                  setCharge(i, 0);
                }}
                onClick={() => {
                  playSfx("confirm");
                  pick(item);
                }}
                className="recipe-opt group relative w-full py-3 text-left sm:py-3.5"
              >
                <span className="inline-flex max-w-full items-baseline gap-4">
                  <span className="recipe-num t-footnote font-sans tabular-nums">
                    0{i + 1}
                  </span>
                  <span className="recipe-name block font-bold leading-[0.92] tracking-[-0.04em]">
                    {item.name}
                  </span>
                </span>
                <span className="recipe-blurb mt-1 block max-w-md pl-12 t-subhead text-label-2">
                  {item.blurb}
                </span>
                <span className="recipe-track ml-12 mt-3 block h-[3px] w-44 overflow-hidden rounded-full bg-white/15">
                  <span
                    data-charge={i}
                    className="menu-charge block h-full origin-left rounded-full bg-tint"
                    style={{ transform: "scaleX(0)" }}
                  />
                </span>
              </button>
            ))}
          </div>

          <p className="t-footnote mt-8 max-w-sm text-label-3">
            Quédate un momento en el nombre para pedirlo. El pellizco
            también vale, si ya estás encima. Con el ratón, el clic basta.
          </p>
        </div>

        <div className="relative mt-10 hidden min-h-[12rem] max-w-md xl:mb-4 xl:mt-0 xl:block xl:w-[min(42%,28rem)]">
          {RECIPES.map((item, i) => (
            <div
              key={item.id}
              data-i={i}
              className="recipe-detail absolute inset-x-0 bottom-0"
            >
              <p className="t-caption uppercase tracking-[0.18em] text-tint">
                {item.name}
              </p>
              <p className="mt-3 text-[clamp(1.05rem,2vw,1.35rem)] font-medium leading-snug tracking-tight text-cream">
                {item.pitch}
              </p>
              <ol className="mt-6 space-y-1.5">
                {item.stages.map((stage, s) => (
                  <li
                    key={stage.id}
                    className="flex items-baseline gap-3 t-subhead text-label-2"
                  >
                    <span className="w-5 font-sans tabular-nums text-tint">
                      {s + 1}
                    </span>
                    {stage.title}
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>

      <div
        ref={pointerRef}
        className="menu-finger menu-finger-parked pointer-events-none absolute left-0 top-0 z-40"
        aria-hidden
      >
        <div className="relative flex h-12 w-12 items-center justify-center">
          <span className="menu-finger-ring absolute inset-0 rounded-full border-2 border-tint" />
          <span className="absolute inset-[6px] rounded-full bg-tint/25" />
          <span className="relative h-2.5 w-2.5 rounded-full bg-tint shadow-[0_0_20px_color-mix(in_srgb,var(--color-tint)_85%,transparent)]" />
        </div>
      </div>

      <p
        ref={hintRef}
        className="pointer-events-none absolute bottom-6 left-1/2 z-40 -translate-x-1/2 t-caption text-label-3 transition-opacity duration-200"
      >
        Apunta con el índice
      </p>
    </div>
  );
}
