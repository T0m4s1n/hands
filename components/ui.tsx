"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";

/**
 * The shared interface pieces. Having exactly one button, one panel and one
 * progress track keeps the app consistent by construction rather than by
 * remembering — which is the only way consistency ever survives a redesign.
 */

/** 44px is the smallest target a finger hits reliably. Nothing here is smaller. */
const TAP = "min-h-[2.75rem]";

export function Sheet({
  children,
  className = "",
  thick = false,
}: {
  children: ReactNode;
  className?: string;
  /**
   * For a panel dense with text sitting over a bright part of the scene. Glass
   * is only worth having while you can still read what is written on it.
   */
  thick?: boolean;
}) {
  return (
    <div
      className={`${thick ? "material-thick" : "material"} squircle rounded-sheet ${className}`}
    >
      {children}
    </div>
  );
}

type ButtonProps = ComponentPropsWithRef<"button"> & {
  variant?: "primary" | "secondary" | "plain";
  children: ReactNode;
};

const VARIANTS = {
  // Filled with the tint: exactly one of these is on screen at a time, and it
  // is always the thing the person most likely came to do.
  primary:
    "bg-tint text-tint-ink font-semibold hover:brightness-110 active:brightness-95",
  secondary:
    "bg-fill-2 text-label font-medium hover:bg-fill-3 active:bg-fill",
  plain: "text-tint font-medium hover:bg-fill active:bg-fill-2",
} as const;

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={`squircle ${TAP} inline-flex items-center justify-center gap-2 rounded-full px-5 text-[0.9375rem] leading-none transition-[transform,background-color,filter] duration-200 ease-sheet active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 ${VARIANTS[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A round control for a single glyph — diagnostics, close, and nothing else. */
export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: ComponentPropsWithRef<"button"> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`material-thin squircle flex h-11 w-11 items-center justify-center rounded-full text-label-2 transition duration-200 ease-sheet hover:text-label active:scale-95 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/**
 * A progress track. `value` is how far along the attempt is; `colour` is how
 * good it currently is — deliberately two different things, because in this
 * game you can be a long way along and doing badly.
 */
export function Meter({
  value,
  colour,
  className = "",
}: {
  value: number;
  colour: string;
  className?: string;
}) {
  return (
    <div
      className={`h-1.5 overflow-hidden rounded-full bg-fill ${className}`}
      role="progressbar"
      aria-valuenow={Math.round(value * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full transition-[width,background-color] duration-200 ease-sheet"
        style={{
          width: `${Math.max(0, Math.min(1, value)) * 100}%`,
          background: colour,
        }}
      />
    </div>
  );
}

/**
 * The final mark, drawn the way a watch draws a day's exercise: a ring that
 * reads at a glance from across the room, with the number inside for anyone
 * who wants the detail.
 */
export function ScoreRing({
  value,
  colour,
  caption,
}: {
  value: number;
  colour: string;
  caption: string;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, value));

  return (
    <div className="relative h-32 w-32">
      <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90">
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke="var(--color-fill)"
          strokeWidth="11"
        />
        <circle
          cx="64"
          cy="64"
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - filled)}
          style={{ transition: "stroke-dashoffset 900ms var(--ease-sheet)" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="t-title tabular-nums">{Math.round(value * 100)}</span>
        <span className="t-caption text-label-3">{caption}</span>
      </div>
    </div>
  );
}
