/**
 * The coffee plant, drawn.
 *
 * La Mejor Taza frames every page with the same botanical border — branches of
 * pointed leaves, clusters of red cherries, loose beans scattered across the
 * field — and it is the single most recognisable thing about the design. Colour
 * alone does not get you there: a flat wine rectangle is just a flat wine
 * rectangle until something grows into it from the edges.
 *
 * Drawn as inline SVG rather than shipped as images so it scales to any screen,
 * takes its colours from the same tokens as everything else, and costs nothing
 * to load.
 */

const LEAF = "#1f7a3d";
const LEAF_DARK = "#14572b";
const CHERRY = "#d8232a";
const CHERRY_DARK = "#9c1119";
const BEAN = "#4a2a17";

/**
 * One leaf, pointed at both ends with a midrib down the middle — the shape a
 * coffee leaf actually has, and the reason it reads as coffee rather than as a
 * generic plant.
 */
function Leaf({
  length,
  tilt,
  at,
  dark = false,
}: {
  length: number;
  tilt: number;
  at: [number, number];
  dark?: boolean;
}) {
  const width = length * 0.34;
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${tilt})`}>
      <path
        d={`M0 0 Q ${length * 0.4} ${-width} ${length} 0 Q ${length * 0.4} ${width} 0 0 Z`}
        fill={dark ? LEAF_DARK : LEAF}
      />
      <path
        d={`M${length * 0.06} 0 L ${length * 0.92} 0`}
        stroke={dark ? LEAF : LEAF_DARK}
        strokeWidth={length * 0.035}
        strokeLinecap="round"
        opacity="0.65"
      />
    </g>
  );
}

function Cherry({ at, size }: { at: [number, number]; size: number }) {
  return (
    <g transform={`translate(${at[0]} ${at[1]})`}>
      <circle r={size} fill={CHERRY} />
      <path
        d={`M0 ${-size} a ${size} ${size} 0 0 0 0 ${size * 2}`}
        fill={CHERRY_DARK}
        opacity="0.45"
      />
      <circle
        cx={-size * 0.3}
        cy={-size * 0.35}
        r={size * 0.22}
        fill="#ff7b74"
      />
    </g>
  );
}

function Bean({
  at,
  size,
  tilt = 0,
}: {
  at: [number, number];
  size: number;
  tilt?: number;
}) {
  return (
    <g transform={`translate(${at[0]} ${at[1]}) rotate(${tilt})`}>
      <ellipse rx={size} ry={size * 0.68} fill={BEAN} />
      <path
        d={`M0 ${-size * 0.6} Q ${size * 0.34} 0 0 ${size * 0.6}`}
        stroke="#2a150b"
        strokeWidth={size * 0.2}
        fill="none"
        strokeLinecap="round"
      />
    </g>
  );
}

/**
 * A branch growing in from a corner. `flip` mirrors it for the other side, so
 * one drawing frames both edges without looking like the same drawing twice.
 */
export function CoffeeBranch({
  className = "",
  flip = false,
  style,
}: {
  className?: string;
  flip?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 220 340"
      className={className}
      // A flipped branch is mirrored here rather than with a utility class so
      // an animation passed in can still own `transform` on the element that
      // carries it — the mirror goes on the group inside instead.
      style={style}
      aria-hidden
      focusable="false"
    >
      <g transform={flip ? "translate(220 0) scale(-1 1)" : undefined}>
        {/* The woody stem the rest hangs off. */}
        <path
          d="M-10 18 C 70 40, 120 110, 132 210 C 138 262, 150 300, 172 340"
          stroke={LEAF_DARK}
          strokeWidth="7"
          fill="none"
          strokeLinecap="round"
        />

        <Leaf length={96} tilt={-32} at={[26, 36]} />
        <Leaf length={80} tilt={38} at={[34, 44]} dark />
        <Leaf length={104} tilt={-8} at={[74, 78]} />
        <Leaf length={86} tilt={62} at={[86, 92]} dark />
        <Leaf length={92} tilt={18} at={[112, 150]} />
        <Leaf length={76} tilt={-48} at={[118, 164]} dark />
        <Leaf length={88} tilt={44} at={[134, 236]} />
        <Leaf length={72} tilt={-26} at={[138, 250]} dark />

        <Cherry at={[64, 70]} size={11} />
        <Cherry at={[84, 58]} size={9} />
        <Cherry at={[74, 88]} size={8} />
        <Cherry at={[120, 186]} size={11} />
        <Cherry at={[140, 176]} size={8} />
        <Cherry at={[150, 268]} size={10} />
        <Cherry at={[168, 256]} size={7} />
      </g>
    </svg>
  );
}

/**
 * Loose beans, scattered the way the brand scatters them across a field.
 *
 * Drawn big. At a size where you have to look for them they read as specks of
 * dirt on the screen; at this size they read as coffee, which is the only
 * reason they are here.
 */
export function ScatteredBeans({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      style={style}
      aria-hidden
      focusable="false"
    >
      <Bean at={[54, 76]} size={34} tilt={-24} />
      <Bean at={[316, 52]} size={26} tilt={40} />
      <Bean at={[136, 200]} size={23} tilt={12} />
      <Bean at={[344, 212]} size={32} tilt={-52} />
      <Bean at={[76, 316]} size={28} tilt={28} />
      <Bean at={[258, 346]} size={25} tilt={-14} />
    </svg>
  );
}

const WING = "#c2186f";
const WING_DEEP = "#8d0f4e";
const BODY = "#15803d";
const BODY_DEEP = "#0d5c2a";

/**
 * The hummingbird.
 *
 * It is the mark La Mejor Taza builds its posters around — magenta wings, a
 * green body, always mid-hover beside the type — and the one element that
 * makes a green rectangle read as this brand rather than as any other green
 * rectangle. Worth drawing properly: the long straight bill, the swept wing,
 * the tail fanned behind.
 */
export function Hummingbird({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="0 0 260 200"
      className={className}
      style={style}
      aria-hidden
      focusable="false"
    >
      {/* The far wing, behind the body and darker, so it has some depth. */}
      <path
        d="M132 92 C 112 52, 66 22, 28 26 C 52 58, 86 84, 132 100 Z"
        fill={WING_DEEP}
      />
      {/* Tail, fanned. */}
      <path d="M140 104 L 214 128 L 206 142 L 136 116 Z" fill={BODY_DEEP} />
      <path d="M140 110 L 222 148 L 210 160 L 136 122 Z" fill={BODY} />

      {/* Body. */}
      <path
        d="M96 96 C 108 78, 134 74, 148 92 C 158 104, 152 122, 136 126 C 116 131, 98 118, 96 96 Z"
        fill={BODY}
      />
      {/* Throat, the bright patch a hummingbird catches the light with. */}
      <path
        d="M104 104 C 112 92, 128 90, 136 100 C 130 114, 114 116, 104 104 Z"
        fill={WING}
        opacity="0.9"
      />
      {/* Head and the long bill. */}
      <circle cx="100" cy="92" r="15" fill={BODY_DEEP} />
      <circle cx="95" cy="88" r="3.4" fill="#f0e8d9" />
      <path
        d="M87 96 L 34 112"
        stroke="#1a1208"
        strokeWidth="5"
        strokeLinecap="round"
      />

      {/* The near wing, swept up and caught mid-beat. */}
      <path
        d="M134 94 C 140 54, 182 20, 234 18 C 224 62, 190 92, 140 106 Z"
        fill={WING}
      />
      <path
        d="M150 84 C 166 62, 192 44, 218 38"
        stroke={WING_DEEP}
        strokeWidth="3.5"
        fill="none"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}
