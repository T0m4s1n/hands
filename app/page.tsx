import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CoffeeBranch, Hummingbird, ScatteredBeans } from "@/components/Botanical";
import { Field, Motes } from "@/components/Field";
import { RECIPES, recipePortrait } from "@/components/coffee/recipes";

export const metadata: Metadata = {
  title: "Café a mano — prepara café con las manos",
  description:
    "Un minijuego de barista que se juega con las manos delante de la cámara. Tres cafés, cinco etapas cada uno, y una nota al final. Todo el seguimiento corre en tu navegador.",
  openGraph: {
    title: "Café a mano",
    description:
      "Prepara café moviendo las manos delante de la cámara. Tres recetas, cinco etapas, una nota.",
    type: "website",
  },
};

/**
 * The front page.
 *
 * A game that needs a camera has to earn the permission prompt before it asks
 * for it, so this page says what the thing is, what it will do with the camera
 * and what it wants from your hands — and only then offers the way in. It
 * renders no 3D at all: it has to be readable instantly, before a megabyte of
 * models is fetched.
 *
 * The first view is a single screen: the promise on the left, the person
 * holding the cup on the right, and the three real drinks sitting as objects
 * rather than as thumbnails. The later fields keep the brand rhythm — wine,
 * roast, green — joined by curved lips instead of ruled lines; see `Field`.
 *
 * Every decorative drawing is clipped to its section and pinned to the outer
 * margin, and it is dropped entirely below the width where that margin exists.
 * Leaves landing on the words is the one way this design fails, and the only
 * reliable fix is a box they cannot leave.
 */

const GESTURES = [
  {
    name: "Pellizca",
    says: "Junta pulgar e índice para tomar un objeto.",
    mark: "pinch",
  },
  {
    name: "Abre",
    says: "Separa los dedos y lo sueltas donde esté.",
    mark: "open",
  },
  {
    name: "Mueve",
    says: "La mano lleva el objeto; la altura la pone el juego.",
    mark: "move",
  },
  {
    name: "Gira",
    says: "Rota la muñeca para inclinar y verter.",
    mark: "turn",
  },
] as const;

/**
 * Each drink, cut out of its photograph.
 *
 * Drawn cups were the wrong instinct — an illustration says "a website about
 * coffee", a photograph says "coffee" — but a photograph in a rectangle is
 * still a picture pinned to the card. Cut the cup out and it stops being a
 * picture of a thing and becomes the thing, sitting on the page.
 *
 * `lift` nudges the apparent size of each one. The box they are fitted into is
 * the same, but a wide saucer and a tall mug do not look the same size when
 * they merely occupy the same box — matching geometry is not matching how
 * large something feels, and only the eye can do that.
 */
const PHOTO: Record<string, { lift: number; alt: string }> = {
  tinto: { lift: 1, alt: "Taza de tinto vista desde arriba." },
  espresso: { lift: 1.1, alt: "Taza de espresso sobre su plato." },
  capuchino: { lift: 1.04, alt: "Capuchino con un rosetón de leche." },
};

const PROMISES = [
  "Tres recetas",
  "Cinco etapas cada una",
  "La cámara no sale de tu equipo",
] as const;

function GestureMark({ kind }: { kind: (typeof GESTURES)[number]["mark"] }) {
  if (kind === "pinch") {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="11" cy="20" r="3.2" fill="currentColor" />
        <circle cx="21" cy="12" r="3.2" fill="currentColor" />
        <path
          d="M13.4 17.6 18.6 14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "open") {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <circle cx="10" cy="16" r="2.6" fill="currentColor" />
        <circle cx="22" cy="16" r="2.6" fill="currentColor" />
        <path
          d="M14 16h4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (kind === "move") {
    return (
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <path
          d="M7 16h14.5M17 10.5 22.5 16 17 21.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
      <path
        d="M9 18.5a7 7 0 1 1 2.2 5.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M8 21.8 9.1 16.8 13.8 19"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

function BrandMark() {
  return (
    <span
      className="squircle flex h-9 w-9 items-center justify-center rounded-tile bg-white text-[color:var(--color-wine)] transition-transform duration-200 ease-sheet hover:rotate-6"
      aria-hidden
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 9h12v5.5A4.5 4.5 0 0 1 11.5 19h-3A4.5 4.5 0 0 1 4 14.5V9Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M16 10.5h1.5a2.5 2.5 0 0 1 0 5H16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

function CupStill({
  id,
  className = "",
  sizes,
  priority = false,
}: {
  id: string;
  className?: string;
  sizes: string;
  priority?: boolean;
}) {
  const photo = PHOTO[id];
  return (
    <span
      className={`relative block h-full w-full ${className}`}
      style={{ transform: `scale(${photo?.lift ?? 1})` }}
    >
      <Image
        src={recipePortrait(id)}
        alt={photo?.alt ?? ""}
        width={560}
        height={560}
        sizes={sizes}
        priority={priority}
        className="portada-cup h-full w-full object-contain"
      />
    </span>
  );
}

export default function Portada() {
  return (
    <main className="min-h-dvh w-full overflow-x-hidden bg-[color:var(--field-deep)] text-label">
      {/* ---------------------------------------------------- hero, wine */}
      <Field
        tone="wine"
        /* The lit pool the brand puts behind its logo, breathing so the field
           is never quite the same twice. */
        glow="radial-gradient(58% 48% at 50% 4%, rgba(190,44,58,0.85), transparent 72%)"
      >
        <Motes />
        {/* Hinged near the stem, so they lean the way a branch does rather
            than sliding about like a sticker. */}
        <CoffeeBranch
          className="pointer-events-none absolute -left-32 top-20 hidden h-[22rem] w-auto origin-top-left lg:block xl:-left-24 xl:h-[24rem]"
          style={{ animation: "sway 13s ease-in-out infinite" }}
        />
        <CoffeeBranch
          flip
          className="pointer-events-none absolute -right-24 top-[22rem] hidden h-[28rem] w-auto origin-top-right lg:block xl:-right-6 xl:h-[32rem]"
          style={{ animation: "sway 17s ease-in-out infinite -4s" }}
        />
        <ScatteredBeans className="pointer-events-none absolute -left-20 bottom-0 hidden h-80 w-auto opacity-75 lg:block" />
        <ScatteredBeans className="pointer-events-none absolute right-2 top-8 hidden h-60 w-auto opacity-50 xl:block" />

        <div className="relative mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-6 sm:px-8 lg:px-14">
          <header className="flex items-center justify-between gap-4 py-6">
            <span className="t-headline flex items-center gap-2.5 font-bold">
              <BrandMark />
              Café a mano
            </span>
            <nav className="flex items-center gap-1">
              <Link
                href="/jugar"
                className="t-footnote squircle rounded-full px-3 py-2 font-semibold text-label transition-colors duration-200 hover:bg-white/15"
              >
                Jugar
              </Link>
              <Link
                href="/manos"
                className="t-footnote squircle rounded-full px-3 py-2 text-label-2 transition-colors duration-200 hover:bg-white/15 hover:text-label"
              >
                Manos
              </Link>
              <Link
                href="/modelos"
                className="t-footnote squircle rounded-full px-3 py-2 text-label-2 transition-colors duration-200 hover:bg-white/15 hover:text-label"
              >
                Modelos
              </Link>
            </nav>
          </header>

          {/* The thin gold rule the brand runs under its masthead. */}
          <div
            aria-hidden
            className="h-px w-full bg-[color:var(--color-tint)] opacity-80"
          />

          <div className="grid flex-1 items-end gap-8 py-10 pb-20 sm:py-14 sm:pb-24 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)] lg:items-center lg:gap-6 lg:pb-24 xl:gap-10">
            <div className="max-w-xl">
              <span className="pill t-caption px-4 py-1.5 uppercase tracking-[0.14em]">
                Minijuego de barista
              </span>
              <h1 className="mt-6 text-[clamp(2.6rem,6.4vw,4.6rem)] font-black leading-[0.96] tracking-[-0.03em]">
                Prepara café
                <br />
                con las manos.
              </h1>
              <p className="t-body mt-6 max-w-lg text-label-2">
                Sin mando y sin teclado. La cámara mira tus manos, tú pellizcas
                para tomar los cacharros y cada etapa se puntúa por lo bien que
                la hagas. No se repite nada: si sale mal, sigues con peor nota.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/jugar"
                  className="squircle group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-[color:var(--color-tint)] px-8 text-[1.0625rem] font-bold text-[color:var(--color-tint-ink)] transition duration-200 ease-sheet hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_36px_-14px_rgba(245,153,10,0.75)] active:translate-y-0 active:scale-[0.97]"
                >
                  Empezar a preparar
                  <span
                    aria-hidden
                    className="transition-transform duration-200 ease-sheet group-hover:translate-x-1"
                  >
                    →
                  </span>
                </Link>
                <a
                  href="#carta"
                  className="t-footnote squircle inline-flex min-h-[2.75rem] items-center rounded-full px-4 text-label-2 transition-colors duration-200 hover:bg-white/10 hover:text-label"
                >
                  Ver la carta
                </a>
              </div>

              <p className="t-footnote mt-4 text-label-3">
                Se puede jugar con ratón si no quieres dar la cámara.
              </p>

              <ul className="mt-8 flex flex-wrap gap-2">
                {PROMISES.map((item) => (
                  <li
                    key={item}
                    className="t-caption rounded-full border border-white/15 bg-white/[0.07] px-3 py-1.5 font-semibold text-label-2"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="relative mx-auto w-full max-w-md sm:max-w-lg lg:max-w-none lg:w-[min(50vw,42rem)] lg:justify-self-end">
              <Image
                src="/art/personaje-taza.png"
                alt="Alguien sostiene una taza grande de café con las dos manos."
                width={992}
                height={741}
                priority
                sizes="(min-width: 1024px) 50vw, 90vw"
                className="portada-figure h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>
      </Field>

      {/* -------------------------------------------- recipes, on the roast */}
      <Field
        tone="roast"
        curve="pour"
        glow="radial-gradient(70% 55% at 50% 8%, rgba(143,24,36,0.4), transparent 68%)"
        className="py-20 sm:py-24"
      >
        <Motes tint="#c98a5a" />
        <ScatteredBeans className="pointer-events-none absolute -right-16 top-20 hidden h-72 w-auto opacity-35 xl:block" />

        <div
          id="carta"
          className="relative mx-auto w-full max-w-5xl scroll-mt-10 px-6 sm:px-8"
        >
          <div className="max-w-xl">
            <span className="t-caption font-bold uppercase tracking-[0.18em] text-[color:var(--color-tint)]">
              La carta
            </span>
            <h2 className="mt-3 text-[clamp(1.875rem,4.5vw,2.75rem)] font-black leading-[1.02] tracking-[-0.02em]">
              Tres cafés.
              <br className="hidden sm:block" />
              Cinco etapas cada uno.
            </h2>
            <p className="t-body mt-4 text-label-2">
              Del cafeto a la taza. Cada receta se prepara distinto y se puntúa
              etapa por etapa — lo que hagas bien o mal se queda en el café.
            </p>
          </div>

          <div className="mt-14 flex flex-col gap-16 sm:gap-20">
            {RECIPES.map((recipe, row) => {
              const reverse = row % 2 === 1;
              return (
                <article
                  key={recipe.id}
                  className={`flex flex-col items-center gap-8 sm:gap-12 ${
                    reverse ? "sm:flex-row-reverse" : "sm:flex-row"
                  }`}
                >
                  <div
                    className="relative aspect-square w-full max-w-[20rem] shrink-0 overflow-hidden rounded-[1.75rem] sm:w-[min(42%,20rem)]"
                    style={{ background: recipe.colour }}
                  >
                    {/* The cup floats on the panel rather than filling it.
                        What sells that is the light behind it and the shadow
                        under it: with neither, a cutout reads as a sticker. */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(48% 42% at 50% 58%, rgba(255,220,160,0.28), transparent 70%)",
                        animation: "field-breathe 14s ease-in-out infinite",
                      }}
                    />
                    <div className="absolute inset-[12%] flex items-center justify-center">
                      <CupStill
                        id={recipe.id}
                        sizes="(max-width: 640px) 70vw, 20rem"
                      />
                    </div>
                  </div>

                  <div className="w-full max-w-xl">
                    <div className="flex items-baseline gap-3">
                      <span
                        className="font-mono text-[0.75rem] font-bold tabular-nums tracking-[0.18em] text-[color:var(--color-tint)]"
                        aria-hidden
                      >
                        {String(row + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-[clamp(1.75rem,3.2vw,2.4rem)] font-black tracking-[-0.03em]">
                        {recipe.name}
                      </h3>
                    </div>
                    <p className="t-subhead mt-2 text-[color:var(--color-tint)]">
                      {recipe.blurb}
                    </p>
                    <p className="t-body mt-4 text-label-2">{recipe.pitch}</p>
                    <ol className="mt-6 flex flex-wrap gap-2">
                      {recipe.stages.map((stage, i) => (
                        <li
                          key={stage.id}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5"
                        >
                          <span
                            className="font-mono text-[0.65rem] font-bold tabular-nums text-[color:var(--color-tint)]"
                            aria-hidden
                          >
                            {i + 1}
                          </span>
                          <span className="t-caption font-semibold tracking-tight">
                            {stage.title}
                          </span>
                        </li>
                      ))}
                    </ol>
                    <div className="mt-8">
                      <Link
                        href="/jugar"
                        className="squircle group/cta inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-full bg-[color:var(--color-tint)] px-6 text-[0.9375rem] font-bold text-[color:var(--color-tint-ink)] transition duration-200 ease-sheet hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_14px_30px_-12px_rgba(245,153,10,0.7)] active:translate-y-0 active:scale-[0.97]"
                      >
                        Preparar {recipe.name.toLowerCase()}
                        <span
                          aria-hidden
                          className="transition-transform duration-200 ease-sheet group-hover/cta:translate-x-1"
                        >
                          →
                        </span>
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </Field>

      {/* ----------------------------------------- gestures, on the green */}
      {/* The green half of the brand, and so where the bird belongs. */}
      <Field
        tone="forest"
        curve="roll"
        glow="radial-gradient(60% 50% at 62% 6%, rgba(46,150,104,0.85), transparent 72%)"
        className="py-20 sm:py-24"
      >
        <Hummingbird
          className="pointer-events-none absolute right-2 top-6 hidden h-44 w-auto opacity-95 lg:block xl:right-8 xl:h-52"
          style={{ animation: "hover-bird 4.5s ease-in-out infinite" }}
        />
        <CoffeeBranch
          className="pointer-events-none absolute -left-24 bottom-0 hidden h-[24rem] w-auto origin-bottom-left opacity-85 xl:block"
          style={{ animation: "sway 15s ease-in-out infinite -7s" }}
        />

        <div className="relative mx-auto w-full max-w-3xl px-6 sm:px-8">
          <span className="t-caption font-bold uppercase tracking-[0.18em] text-[color:var(--color-tint)]">
            Cómo se juega
          </span>
          <h2 className="mt-3 max-w-md text-[clamp(1.625rem,4vw,2.25rem)] font-black tracking-[-0.02em]">
            Cuatro gestos y ya
          </h2>
          <dl className="mt-8 grid gap-3 sm:grid-cols-2">
            {GESTURES.map((gesture) => (
              <div
                key={gesture.name}
                className="squircle flex gap-3 rounded-card border border-white/10 bg-white/[0.06] p-4 transition duration-300 ease-sheet hover:-translate-y-0.5 hover:border-[color:var(--color-tint)]/50 hover:bg-white/[0.12]"
              >
                <span className="mt-0.5 text-[color:var(--color-tint)]">
                  <GestureMark kind={gesture.mark} />
                </span>
                <div>
                  <dt className="t-footnote font-bold text-[color:var(--color-tint)]">
                    {gesture.name}
                  </dt>
                  <dd className="t-footnote mt-1 text-label-2">{gesture.says}</dd>
                </div>
              </div>
            ))}
          </dl>

          <div className="squircle mt-8 rounded-card border border-white/15 bg-black/25 p-6">
            <h3 className="t-headline font-bold">Sobre tu cámara</h3>
            <p className="t-subhead mt-2 text-label-2">
              El seguimiento corre entero dentro de tu navegador, sobre el
              modelo de manos de MediaPipe. La imagen no sale de tu equipo: no
              se sube, no se guarda y no hay servidor al que mandarla. Puedes
              comprobarlo desconectando la red una vez cargado el juego.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/jugar"
              className="squircle group inline-flex min-h-[3.25rem] items-center justify-center gap-2 rounded-full bg-[color:var(--color-tint)] px-8 text-[1.0625rem] font-bold text-[color:var(--color-tint-ink)] transition duration-200 ease-sheet hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[0_16px_36px_-14px_rgba(245,153,10,0.75)] active:translate-y-0 active:scale-[0.97]"
            >
              Empezar a preparar
              <span
                aria-hidden
                className="transition-transform duration-200 ease-sheet group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
            <span className="t-footnote text-label-3">
              Pediremos la cámara al entrar. El ratón también vale.
            </span>
          </div>
        </div>
      </Field>

      {/* -------------------------------------------- footer, on the deep */}
      <Field tone="deep" curve="hill" className="pb-10 pt-8">
        <div className="relative mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 sm:px-8">
          <p className="t-caption max-w-lg text-label-3">
            Modelos y sonidos de{" "}
            <a
              href="https://kenney.nl"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)] hover:decoration-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Kenney
            </a>{" "}
            bajo CC0 (incl. Digital Audio). Manos del kit de perfiles de entrada
            WebXR, MIT. Fotos de los cafés por{" "}
            <a
              href="https://unsplash.com/@reinisbruzitis"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Reinis Bruzitis
            </a>
            ,{" "}
            <a
              href="https://unsplash.com/@gabimirandan"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Gabi Miranda
            </a>{" "}
            y{" "}
            <a
              href="https://unsplash.com/@pundalex"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Alex Boyd
            </a>
            . La carta del juego,{" "}
            <a
              href="https://unsplash.com/@nickkimel"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Nick Kimel
            </a>{" "}
            y Unsplash.
          </p>
          <nav className="flex flex-wrap gap-1">
            {[
              { href: "/jugar", label: "Jugar" },
              { href: "/manos", label: "Laboratorio de manos" },
              { href: "/modelos", label: "Modelos" },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="t-caption squircle rounded-full px-3 py-1.5 text-label-2 transition-colors duration-200 hover:bg-white/10 hover:text-label"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </Field>
    </main>
  );
}
