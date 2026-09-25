"use client";

import { useEffect, useRef, useState } from "react";
import { playSfx } from "@/lib/audio";
import {
  COUNTDOWN_BEATS,
  countdownBeatDuration,
  countdownBeatSound,
} from "./countdownSchedule";

/**
 * Nintendo 3-2-1 over the live cafe. After the last beat the game starts
 * on this same table — no second iris, no dummy scene.
 */
export function Countdown({ onDone }: { onDone: () => void }) {
  const [beat, setBeat] = useState(0);
  const doneRef = useRef(false);

  useEffect(() => {
    if (beat >= COUNTDOWN_BEATS.length) {
      if (doneRef.current) return;
      doneRef.current = true;
      onDone();
      return;
    }
    const sound = countdownBeatSound(beat);
    if (sound) playSfx(sound, { force: true });
    const id = window.setTimeout(
      () => setBeat((value) => value + 1),
      countdownBeatDuration(beat),
    );
    return () => window.clearTimeout(id);
  }, [beat, onDone]);

  const glyph = COUNTDOWN_BEATS[beat];
  if (!glyph) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgb(20_3_8/0.28)_100%)]" />
      <p
        key={glyph}
        className={`count-pop text-hero relative font-semibold leading-[0.85] tracking-[-0.06em] text-cream tabular-nums ${
          glyph === "¡YA!"
            ? "text-[clamp(4.5rem,16vw,8rem)] text-tint"
            : "text-[clamp(6.5rem,22vw,11rem)]"
        }`}
      >
        {glyph}
      </p>
    </div>
  );
}
