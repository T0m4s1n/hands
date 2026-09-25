"use client";

/**
 * Live cup SVG — reacts to stage progress, quality, hurry and pour.
 * Floating HUD chrome; no card behind it.
 */

export type CupMood = {
  /** 0..1 fill of the current stage (or brew so far). */
  fill: number;
  /** 0..1 how well the attempt is going. */
  quality: number;
  /** Player is holding something. */
  holding: boolean;
  /** Stage is about to auto-commit. */
  hurry: boolean;
  /** Actively pouring / filling. */
  working: boolean;
};

export function LiveCup({
  fill,
  quality,
  holding,
  hurry,
  working,
  className = "",
}: CupMood & { className?: string }) {
  const level = Math.min(1, Math.max(0, fill));
  const good = Math.min(1, Math.max(0, quality));
  const liquidY = 58 - level * 28;
  const steam = working || level > 0.35;
  const face =
    hurry ? "worried" : good >= 0.75 ? "happy" : good >= 0.4 ? "ok" : "flat";

  return (
    <svg
      viewBox="0 0 72 84"
      className={`live-cup ${holding ? "live-cup-hold" : ""} ${hurry ? "live-cup-hurry" : ""} ${className}`}
      aria-hidden
    >
      {steam && (
        <g className="live-cup-steam" fill="none" stroke="#fff6ea" strokeWidth="1.6" strokeLinecap="round" opacity="0.55">
          <path d="M28 14c0-6 4-8 4-12" className="live-cup-wisp" />
          <path d="M36 12c0-7 5-9 5-14" className="live-cup-wisp" style={{ animationDelay: "0.35s" }} />
          <path d="M44 14c0-6 4-8 4-12" className="live-cup-wisp" style={{ animationDelay: "0.7s" }} />
        </g>
      )}

      {/* Saucer */}
      <ellipse cx="36" cy="74" rx="22" ry="4.5" fill="#f0e8d9" opacity="0.35" />

      {/* Cup body */}
      <path
        d="M18 30h36l-3.5 36c-0.4 4.2-4 7.5-8.2 7.5H29.7c-4.2 0-7.8-3.3-8.2-7.5L18 30Z"
        fill="#fff6ea"
        stroke="#3d1206"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Handle */}
      <path
        d="M54 36c8 2 11 10 8 16s-10 8-14 5"
        fill="none"
        stroke="#3d1206"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Liquid clip */}
      <defs>
        <clipPath id="live-cup-clip">
          <path d="M20.2 32h31.6l-3.2 33.2c-0.3 3.4-3.2 6-6.6 6H30c-3.4 0-6.3-2.6-6.6-6L20.2 32Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#live-cup-clip)">
        <rect
          x="18"
          y={liquidY}
          width="36"
          height="44"
          fill={good > 0.6 ? "#5c2a14" : "#3b1a0c"}
          className={working ? "live-cup-slosh" : undefined}
        />
        {level > 0.08 && (
          <ellipse
            cx="36"
            cy={liquidY + 1}
            rx="15"
            ry="3.2"
            fill={good > 0.7 ? "#c98f5a" : "#8a5a32"}
            opacity="0.9"
          />
        )}
      </g>

      {/* Face */}
      <g transform="translate(36 48)" fill="#3d1206">
        {face === "happy" && (
          <>
            <circle cx="-6" cy="-2" r="1.6" />
            <circle cx="6" cy="-2" r="1.6" />
            <path d="M-6 5c3 4 9 4 12 0" fill="none" stroke="#3d1206" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {face === "ok" && (
          <>
            <circle cx="-6" cy="-2" r="1.6" />
            <circle cx="6" cy="-2" r="1.6" />
            <path d="M-5 6h10" fill="none" stroke="#3d1206" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {face === "flat" && (
          <>
            <circle cx="-6" cy="-2" r="1.6" />
            <circle cx="6" cy="-2" r="1.6" />
            <path d="M-5 7c2-2 8-2 10 0" fill="none" stroke="#3d1206" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
        {face === "worried" && (
          <>
            <path d="M-9-5l4 2M9-5l-4 2" fill="none" stroke="#3d1206" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="-6" cy="-1" r="1.7" />
            <circle cx="6" cy="-1" r="1.7" />
            <path d="M-5 8c3-3 7-3 10 0" fill="none" stroke="#3d1206" strokeWidth="1.8" strokeLinecap="round" />
          </>
        )}
      </g>
    </svg>
  );
}
