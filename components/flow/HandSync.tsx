"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { TrackedHand } from "@/hooks/useHandTracking";
import { playSfx } from "@/lib/audio";

/**
 * How long a hand has to stay in frame before it counts as locked.
 *
 * Tracking flickers on the first second. Lighting a slot the instant a
 * landmark appears would flash ready / not ready and teach the player
 * nothing. A beat of stillness is the difference between "I saw you" and
 * "you are here".
 */
const LOCK_FOR = 0.9;
/** One locked hand is enough to leave; both is the polite ask. */
const LEAVE_AFTER = 0.55;

type Slot = { seen: boolean; locked: boolean };

export function HandSync({
  handsRef,
  onReady,
  onPointerFallback,
}: {
  handsRef: RefObject<TrackedHand[]>;
  onReady: () => void;
  onPointerFallback: () => void;
}) {
  const [left, setLeft] = useState<Slot>({ seen: false, locked: false });
  const [right, setRight] = useState<Slot>({ seen: false, locked: false });
  const holdRef = useRef({ Left: 0, Right: 0, ready: 0 });
  const doneRef = useRef(false);
  const heardRef = useRef({ left: false, right: false });

  useEffect(() => {
    let last = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.08, (now - last) / 1000);
      last = now;
      const hands = handsRef.current ?? [];
      const seenLeft = hands.some(
        (hand) => hand.handedness === "Left" && hand.tracking !== undefined,
      );
      const seenRight = hands.some(
        (hand) => hand.handedness === "Right" && hand.tracking !== undefined,
      );
      const hold = holdRef.current;
      hold.Left = seenLeft ? hold.Left + dt : 0;
      hold.Right = seenRight ? hold.Right + dt : 0;
      const lockedLeft = hold.Left >= LOCK_FOR;
      const lockedRight = hold.Right >= LOCK_FOR;
      if (lockedLeft && !heardRef.current.left) playSfx("sync");
      if (lockedRight && !heardRef.current.right) playSfx("sync");
      heardRef.current.left = lockedLeft;
      heardRef.current.right = lockedRight;
      setLeft((prev) =>
        prev.seen === seenLeft && prev.locked === lockedLeft
          ? prev
          : { seen: seenLeft, locked: lockedLeft },
      );
      setRight((prev) =>
        prev.seen === seenRight && prev.locked === lockedRight
          ? prev
          : { seen: seenRight, locked: lockedRight },
      );
      const locked = Number(lockedLeft) + Number(lockedRight);
      hold.ready = locked >= 1 ? hold.ready + dt : 0;
      if (!doneRef.current && hold.ready >= LEAVE_AFTER) {
        doneRef.current = true;
        onReady();
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [handsRef, onReady]);

  const both = left.locked && right.locked;
  const one = left.locked || right.locked;
  const line = both
    ? "Las dos. Ahí está."
    : one
      ? "Una lista. La otra, si puedes."
      : "Acerca las palmas y quédate un momento.";

  return (
    <div className="gate-veil pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center px-6 pb-24 text-center [@media(max-height:700px)]:pb-3 sm:pb-16">
      <h1 className="flex flex-col items-center">
        <span className="text-[clamp(1.6rem,5vw,3.25rem)] font-semibold leading-none tracking-tight text-tint">
          Sincronicemos
        </span>
        <span className="gate-title mt-1">las manos</span>
      </h1>
      <div className="mt-6 flex items-end justify-center gap-10 sm:mt-8 sm:gap-16">
        <SyncPalm label="Izquierda" side="left" slot={left} />
        <SyncPalm label="Derecha" side="right" slot={right} />
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
        ¿No aparecen? Jugar con ratón
      </button>
    </div>
  );
}

function SyncPalm({
  label,
  side,
  slot,
}: {
  label: string;
  side: "left" | "right";
  slot: Slot;
}) {
  const mood = slot.locked ? "lock" : slot.seen ? "seen" : "wait";
  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox="0 0 160 200"
        className={`sync-hand sync-hand-${mood} h-40 w-32 [@media(max-height:700px)]:h-36 [@media(max-height:700px)]:w-28 sm:h-52 sm:w-40 ${
          side === "left" ? "-scale-x-100" : ""
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
        {label}
      </p>
    </div>
  );
}
