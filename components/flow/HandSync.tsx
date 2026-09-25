"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { Handedness, TrackedHand } from "@/hooks/useHandTracking";
import { playSfx } from "@/lib/audio";
import {
  SYNC_LEAVE_S,
  SYNC_LOCK_S,
  stepSyncSide,
  syncCanLeave,
  syncSideFromHand,
  syncSideLabel,
} from "./syncHands";

type Slot = { side: Handedness | null; seen: boolean; locked: boolean };

export function HandSync({
  handsRef,
  onReady,
  onPointerFallback,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onReady: () => void;
  onPointerFallback: () => void;
}) {
  const [slot, setSlot] = useState<Slot>({
    side: null,
    seen: false,
    locked: false,
  });
  const holdRef = useRef<{ side: Handedness | null; seconds: number; ready: number }>({
    side: null,
    seconds: 0,
    ready: 0,
  });
  const doneRef = useRef(false);
  const heardRef = useRef(false);

  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const hands = handsRef.current ?? [];
      let seen: Handedness | null = null;
      for (const hand of hands) {
        const side = syncSideFromHand(hand);
        if (side) {
          seen = side;
          break;
        }
      }
      const hold = holdRef.current;
      const next = stepSyncSide(
        { side: hold.side, seconds: hold.seconds },
        seen,
        dt,
      );
      hold.side = next.side;
      hold.seconds = next.seconds;
      const locked = Boolean(next.side) && next.seconds >= SYNC_LOCK_S;
      if (locked && !heardRef.current) playSfx("sync");
      heardRef.current = locked;
      setSlot((prev) =>
        prev.side === next.side &&
        prev.seen === Boolean(seen) &&
        prev.locked === locked
          ? prev
          : { side: next.side, seen: Boolean(seen), locked },
      );
      hold.ready = locked ? hold.ready + dt : 0;
      if (!doneRef.current && syncCanLeave(locked ? 1 : 0, hold.ready)) {
        doneRef.current = true;
        onReady();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [handsRef, onReady]);

  const name = syncSideLabel(slot.side);
  const line = slot.locked
    ? `Mano ${name}. Listo.`
    : slot.seen
      ? `Detectando la mano ${name}… quédate así.`
      : "Levanta una palma y quédate un momento. Veremos si es la izquierda o la derecha.";

  return (
    <div className="gate-veil pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pb-24 text-center [@media(max-height:700px)]:pb-3 sm:pb-16">
      <h1 className="flex flex-col items-center">
        <span className="text-[clamp(1.6rem,5vw,3.25rem)] font-semibold leading-none tracking-tight text-tint">
          Sincronicemos
        </span>
        <span className="gate-title mt-1">la mano</span>
      </h1>
      <div className="mt-6 flex items-end justify-center sm:mt-8">
        <SyncPalm side={slot.side} slot={slot} />
      </div>
      <p className="t-body mt-6 max-w-md text-label-2" role="status" aria-live="polite">
        {line}
      </p>
      <button
        type="button"
        onClick={() => {
          playSfx("click");
          onPointerFallback();
        }}
        className="pointer-events-auto mt-5 rounded-full px-4 py-2 text-sm font-bold text-tint underline decoration-tint/45 underline-offset-4 transition-colors hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-tint"
      >
        ¿No aparece? Jugar con ratón
      </button>
    </div>
  );
}

function SyncPalm({
  side,
  slot,
}: {
  side: Handedness | null;
  slot: Slot;
}) {
  const mood = slot.locked ? "lock" : slot.seen ? "seen" : "wait";
  const mirror = side === "Left";
  const caption = side === "Left" ? "Izquierda" : side === "Right" ? "Derecha" : "Una palma";
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 160 200"
        className={`sync-hand sync-hand-${mood} h-40 w-32 [@media(max-height:700px)]:h-36 [@media(max-height:700px)]:w-28 sm:h-52 sm:w-40 ${
          mirror ? "-scale-x-100" : ""
        }`}
        aria-hidden
      >
        <ellipse
          className={slot.locked ? "sync-ring" : undefined}
          cx="80"
          cy="118"
          rx="62"
          ry="70"
          fill="#f5990a"
          opacity={slot.locked ? 0.28 : 0}
        />
        <g className="sync-wave" fill="currentColor" stroke="#3d1206" strokeWidth="2.6" strokeLinejoin="round">
          <rect x="60" y="154" width="40" height="30" rx="14" />
          <ellipse
            className="sync-finger"
            style={{ animationDelay: "-0.85s" }}
            cx="34"
            cy="120"
            rx="17"
            ry="28"
            transform="rotate(-40 34 120)"
          />
          <ellipse
            className="sync-finger"
            style={{ animationDelay: "0s" }}
            cx="52"
            cy="58"
            rx="14"
            ry="34"
          />
          <ellipse
            className="sync-finger"
            style={{ animationDelay: "-0.28s" }}
            cx="78"
            cy="46"
            rx="15"
            ry="38"
          />
          <ellipse
            className="sync-finger"
            style={{ animationDelay: "-0.52s" }}
            cx="104"
            cy="52"
            rx="14"
            ry="34"
          />
          <ellipse
            className="sync-finger"
            style={{ animationDelay: "-0.7s" }}
            cx="126"
            cy="70"
            rx="13"
            ry="26"
          />
          <ellipse cx="80" cy="118" rx="46" ry="42" />
          {mood === "lock" ? (
            <>
              <circle cx="64" cy="112" r="4.2" fill="#3d1206" />
              <circle cx="96" cy="112" r="4.2" fill="#3d1206" />
              <path
                d="M66 132c10 10 18 10 28 0"
                fill="none"
                stroke="#3d1206"
                strokeWidth="3.6"
                strokeLinecap="round"
              />
            </>
          ) : mood === "seen" ? (
            <>
              <circle cx="64" cy="112" r="3.6" fill="#3d1206" />
              <circle cx="96" cy="112" r="3.6" fill="#3d1206" />
              <path
                d="M70 132c8 5 12 5 20 0"
                fill="none"
                stroke="#3d1206"
                strokeWidth="3.2"
                strokeLinecap="round"
              />
            </>
          ) : (
            <>
              <path
                d="M56 112h16"
                stroke="#3d1206"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.4"
              />
              <path
                d="M88 112h16"
                stroke="#3d1206"
                strokeWidth="3.2"
                strokeLinecap="round"
                opacity="0.4"
              />
            </>
          )}
        </g>
      </svg>
      <p
        className={`t-caption uppercase tracking-[0.16em] ${
          slot.locked ? "text-tint" : "text-label-3"
        }`}
      >
        {caption}
      </p>
    </div>
  );
}
