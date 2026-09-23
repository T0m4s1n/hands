"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { KIT, PIECES } from "@/components/coffee/kit";
import { Sheet } from "@/components/ui";

const ModelLabScene = dynamic(
  () => import("@/components/ModelLabScene").then((mod) => mod.ModelLabScene),
  { ssr: false },
);

/**
 * Every model the game can put on the counter, on one turntable.
 *
 * The point is to catch the things that only show up once a model is in the
 * scene and are miserable to find from inside a five-stage game: a piece that
 * loads but measures wrong, one whose texture did not travel with it, one
 * facing the wrong way, one whose collider is nothing like its shape. Here they
 * are all in a row, at the size the game will use, with the collider drawn over
 * the top.
 */

export function ModelLab() {
  const [showSolids, setShowSolids] = useState(true);
  const [spin, setSpin] = useState(true);
  const [picked, setPicked] = useState<string | null>(null);

  const scene = useMemo(
    () => (
      <Suspense fallback={null}>
        <ModelLabScene showSolids={showSolids} spin={spin} picked={picked} />
      </Suspense>
    ),
    [showSolids, spin, picked],
  );

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-canvas text-label">
      <div className="absolute inset-0">{scene}</div>

      <div className="pointer-events-none absolute inset-0 z-10 flex justify-between gap-4 overflow-y-auto p-4 sm:p-6">
        <Sheet className="pointer-events-auto flex w-72 shrink-0 flex-col gap-4 self-start p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h1 className="t-headline">Modelos</h1>
            <Link
              href="/jugar"
              className="t-footnote text-tint transition hover:brightness-110"
            >
              al juego
            </Link>
          </div>

          <p className="t-caption text-label-3">
            Cada pieza al tamaño que usa el juego, con su collider encima. Si
            algo carga mal, se mide mal o mira al revés, se ve aquí.
          </p>

          <label className="t-footnote flex min-h-[2.25rem] cursor-pointer items-center gap-2.5 text-label-2">
            <input
              type="checkbox"
              checked={showSolids}
              onChange={(event) => setShowSolids(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-tint)]"
            />
            Mostrar colliders
          </label>
          <label className="t-footnote flex min-h-[2.25rem] cursor-pointer items-center gap-2.5 text-label-2">
            <input
              type="checkbox"
              checked={spin}
              onChange={(event) => setSpin(event.target.checked)}
              className="h-4 w-4 accent-[var(--color-tint)]"
            />
            Girar
          </label>

          <div className="border-t border-separator pt-3">
            <p className="t-caption mb-2 text-label-3">
              {PIECES.length} piezas
            </p>
            <ul className="space-y-0.5">
              {PIECES.map(({ kind, entry }) => (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() =>
                      setPicked((was) => (was === kind ? null : kind))
                    }
                    className={`t-footnote flex w-full items-baseline justify-between gap-2 rounded-lg px-2 py-1 text-left transition ${
                      picked === kind
                        ? "bg-tint/20 text-tint"
                        : "text-label-2 hover:bg-fill"
                    }`}
                  >
                    <span className="truncate">{kind}</span>
                    <span className="shrink-0 font-mono text-label-3 tabular-nums">
                      {entry.size.toFixed(2)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Sheet>

        <Sheet className="pointer-events-auto w-72 shrink-0 self-start p-5">
          <h2 className="t-headline">
            {picked ?? "Todo el kit"}
          </h2>
          {picked ? (
            <Detail kind={picked} />
          ) : (
            <p className="t-footnote mt-2 text-label-2">
              Elige una pieza de la lista para aislarla y ver sus números.
            </p>
          )}
        </Sheet>
      </div>
    </div>
  );
}

function Detail({ kind }: { kind: string }) {
  const entry = KIT[kind as keyof typeof KIT];
  if (!entry) return null;
  const shape = entry.solid.shape;

  const rows: [string, string][] = [
    ["archivo", entry.file],
    ["carpeta", entry.dir ?? "kit"],
    ["tamaño", entry.size.toFixed(2)],
    ["giro", (entry.yaw ?? 0).toFixed(2)],
    ["masa", entry.solid.mass.toFixed(1)],
    ["fricción", entry.solid.friction.toFixed(2)],
    ["forma", shape.kind],
    [
      "medidas",
      shape.kind === "slab"
        ? `${(shape.halfLong * 2).toFixed(2)} × ${(shape.halfShort * 2).toFixed(2)} × ${shape.height.toFixed(2)}`
        : `r ${shape.radius.toFixed(2)} · h ${shape.height.toFixed(2)}`,
    ],
  ];
  if (entry.vessel) {
    rows.push([
      "recipiente",
      `r ${entry.vessel.radius.toFixed(2)} · fondo ${entry.vessel.floor.toFixed(2)} · hondo ${entry.vessel.depth.toFixed(2)}`,
    ]);
  }
  if (entry.hide) rows.push(["oculta", entry.hide.join(", ")]);

  return (
    <dl className="mt-3 space-y-1.5">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-baseline justify-between gap-3">
          <dt className="t-caption shrink-0 text-label-3">{label}</dt>
          <dd className="t-footnote truncate text-right font-mono text-label-2">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}
