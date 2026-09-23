/**
 * The coloured grounds the page is built out of.
 *
 * Each section owns a colour outright, which is what gives the page its
 * rhythm. The difficulty was always the join: two flat rectangles meeting is a
 * ruled line across the page, and a ruled line reads as a mistake rather than
 * as a change of subject.
 *
 * So a field does not begin at its own top edge. It grows a curved lip upward
 * into whatever is above it, painted in its own colour, and the change of
 * ground happens along that curve. The eye reads a shape — something poured,
 * or a hill — instead of an edge, and the two colours are allowed to be as
 * different as they like.
 *
 * On top of that, nothing here is a flat fill: every field carries grain, most
 * carry a slow breathing glow, and the loose beans drift. All of it moves on
 * transform and opacity only, and all of it stops for anyone who has asked
 * their system for less movement.
 */

export type Tone = "wine" | "roast" | "forest" | "deep";

const TONE: Record<Tone, string> = {
  wine: "var(--field-wine)",
  roast: "var(--field-roast)",
  forest: "var(--field-forest)",
  deep: "var(--field-deep)",
};

/**
 * The lip each field grows into the one above it. Three different profiles,
 * because the same curve three times down a page stops being a gesture and
 * starts being a border style.
 */
const CURVES = {
  /** A long, lazy roll — the gentlest of the three. */
  roll: "M0,120 C 220,18 470,4 720,48 C 960,90 1190,96 1440,34 L1440,120 Z",
  /** Off-centre and steeper on the left, like liquid finding a level. */
  pour: "M0,120 C 180,120 250,10 520,22 C 830,36 1080,104 1440,58 L1440,120 Z",
  /** Two shallow crests, for the quietest join. */
  hill: "M0,120 C 300,52 420,104 720,86 C 1010,68 1170,20 1440,74 L1440,120 Z",
} as const;

export type Curve = keyof typeof CURVES;

export function Field({
  tone,
  curve,
  glow,
  children,
  className = "",
}: {
  tone: Tone;
  /** Omitted for the first field, which has nothing above it to grow into. */
  curve?: Curve;
  /** A lit pool inside the field, in whatever colour suits it. */
  glow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const colour = TONE[tone];
  return (
    // Not clipped, so the lip can reach up out of the section. The clipping
    // that keeps the leaves off the words happens on the section inside.
    <div className="relative">
      {curve && (
        <svg
          aria-hidden
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          className="absolute bottom-full left-0 block h-10 w-full sm:h-16 lg:h-20"
        >
          <path d={CURVES[curve]} fill={colour} />
        </svg>
      )}
      <section
        className={`grain relative overflow-hidden ${className}`}
        style={{ background: colour }}
      >
        {glow && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0"
            style={{
              background: glow,
              animation: "field-breathe 14s ease-in-out infinite",
              transformOrigin: "50% 20%",
            }}
          />
        )}
        {children}
      </section>
    </div>
  );
}

/**
 * Loose beans and husk drifting across a field.
 *
 * Positions are written down rather than randomised: a layout that reshuffles
 * on every render is a layout nobody can correct, and these are placed to stay
 * out of the text column.
 */
const MOTES = [
  { left: "6%", top: "18%", size: 7, dx: "18px", dy: "-26px", dr: "24deg", secs: 17 },
  { left: "13%", top: "62%", size: 4, dx: "-14px", dy: "20px", dr: "-30deg", secs: 23 },
  { left: "21%", top: "88%", size: 5, dx: "10px", dy: "-16px", dr: "16deg", secs: 19 },
  { left: "78%", top: "12%", size: 5, dx: "-20px", dy: "18px", dr: "-22deg", secs: 21 },
  { left: "88%", top: "48%", size: 8, dx: "12px", dy: "-24px", dr: "28deg", secs: 26 },
  { left: "94%", top: "76%", size: 4, dx: "-16px", dy: "-14px", dr: "-18deg", secs: 15 },
  { left: "68%", top: "92%", size: 6, dx: "14px", dy: "22px", dr: "20deg", secs: 24 },
  { left: "40%", top: "6%", size: 3, dx: "8px", dy: "18px", dr: "-14deg", secs: 20 },
] as const;

export function Motes({ tint = "#f0e8d9" }: { tint?: string }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {MOTES.map((mote, i) => (
        <span
          key={i}
          className="absolute block rounded-full"
          style={
            {
              left: mote.left,
              top: mote.top,
              width: mote.size,
              height: mote.size * 0.7,
              background: tint,
              opacity: 0.16,
              "--dx": mote.dx,
              "--dy": mote.dy,
              "--dr": mote.dr,
              animation: `mote-drift ${mote.secs}s ease-in-out infinite`,
              animationDelay: `${i * -2.6}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
