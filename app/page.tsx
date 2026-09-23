import type { Metadata } from "next";
import Link from "next/link";
import { CoffeeBranch, Hummingbird, ScatteredBeans } from "@/components/Botanical";
import Image from "next/image";
import { Field, Motes } from "@/components/Field";
import { RECIPES } from "@/components/coffee/recipes";

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
 * The look is La Mejor Taza's: the deep wine to open on, white type doing the
 * shouting, one amber thing to press, and the coffee plant growing in from the
 * edges.
 *
 * The brand also uses a green, and the way this page gets from one to the
 * other is the whole layout decision. Each section owns its colour outright —
 * that is what gives the page a rhythm — but they do not meet along a ruled
 * line, which is what made the change look like a mistake. Every field grows a
 * curved lip up into the one above it, so the ground changes along a shape
 * instead of an edge; see `Field`. They are ordered wine, roast, green, so the
 * one hue jump that has no good middle happens down in the dark where there is
 * no colour left to argue about.
 *
 * None of the fields is a flat fill either: each carries grain, a slow
 * breathing pool of light, and drifting husk. The cream is kept for the cards
 * alone, so it arrives as objects on the field rather than as a hole punched
 * through it.
 *
 * Every decorative drawing is clipped to its section and pinned to the outer
 * margin, and it is dropped entirely below the width where that margin exists.
 * Leaves landing on the words is the one way this design fails, and the only
 * reliable fix is a box they cannot leave.
 */

const GESTURES = [
  { name: "Pellizca", says: "Junta pulgar e índice para tomar un objeto." },
  { name: "Abre", says: "Separa los dedos y lo sueltas donde esté." },
  { name: "Mueve", says: "La mano lleva el objeto; la altura la pone el juego." },
  { name: "Gira", says: "Rota la muñeca para inclinar y verter." },
] as const;

/**
 * Each drink, cut out of its photograph.
 *
 * Drawn cups were the wrong instinct — an illustration says "a website about
 * coffee", a photograph says "coffee" — but a photograph in a rectangle is
 * still a picture pinned to the card. Cut the cup out and it stops being a
 * picture of a thing and becomes the thing, sitting on the page.
 *
 * The cutouts were lifted from the originals with Vision's foreground mask,
 * the same one behind "copy subject" in Photos, then trimmed to their own
 * bounds so that one CSS height means the same size for all three. PNG for
 * the alpha; next/image serves WebP to anything that takes it.
 *
 * `lift` nudges the apparent size of each one. The box they are fitted into is
 * the same, but a wide saucer and a tall mug do not look the same size when
 * they merely occupy the same box — matching geometry is not matching how big
 * something looks, and only the eye can settle the difference.
 */
const PHOTO: Record<
  string,
  { src: string; alt: string; lift: number }
> = {
  tinto: {
    src: "/cafes/tinto.png",
    alt: "Taza de café negro vista desde arriba, sin leche.",
    lift: 1,
  },
  espresso: {
    src: "/cafes/espresso.png",
    alt: "Espresso corto en taza blanca sobre su plato, con la crema encima.",
    lift: 1.1,
  },
  capuchino: {
    src: "/cafes/capuchino.png",
    alt: "Capuchino con un rosetón de espuma dibujado sobre el café.",
    lift: 1.04,
  },
};

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
          className="pointer-events-none absolute -left-20 top-24 hidden h-[26rem] w-auto origin-top-left lg:block xl:-left-6 xl:h-[30rem]"
          style={{ animation: "sway 13s ease-in-out infinite" }}
        />
        <CoffeeBranch
          flip
          className="pointer-events-none absolute -right-24 top-[22rem] hidden h-[28rem] w-auto origin-top-right lg:block xl:-right-6 xl:h-[32rem]"
          style={{ animation: "sway 17s ease-in-out infinite -4s" }}
        />
        <ScatteredBeans className="pointer-events-none absolute -left-20 bottom-0 hidden h-80 w-auto opacity-75 lg:block" />
        <ScatteredBeans className="pointer-events-none absolute right-2 top-8 hidden h-60 w-auto opacity-50 xl:block" />

        <div className="relative mx-auto w-full max-w-3xl px-6 sm:px-8">
          <header className="flex items-center justify-between gap-4 py-6">
            <span className="t-headline flex items-center gap-2.5 font-bold">
              <span
                className="squircle flex h-8 w-8 items-center justify-center rounded-tile bg-white text-[color:var(--color-wine)] transition-transform duration-200 ease-sheet hover:rotate-6"
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
              Café a mano
            </span>
            <nav className="flex items-center gap-1">
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

          <div className="py-20 sm:py-24">
            <span className="pill t-caption px-4 py-1.5 uppercase tracking-[0.14em]">
              Minijuego de barista
            </span>
            <h1 className="mt-6 text-[clamp(2.5rem,6.5vw,4.25rem)] font-black leading-[0.98] tracking-[-0.02em]">
              Prepara café moviendo
              <br className="hidden sm:block" /> las manos delante de la cámara.
            </h1>
            <p className="t-body mt-6 max-w-xl text-label-2">
              Sin mando y sin teclado. La cámara mira tus manos, tú pellizcas
              para tomar los cacharros y cada etapa se puntúa por lo bien que la
              hagas. No se repite nada: si sale mal, sigues con peor nota.
            </p>

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
                Se puede jugar con ratón si no quieres dar la cámara.
              </span>
            </div>
          </div>
        </div>

      </Field>

      {/* -------------------------------------------- recipes, on the roast */}
      {/* The darkest ground on the page, and the reason the cream cards read
          as objects sitting on it rather than as panels cut out of it. */}
      <Field
        tone="roast"
        curve="pour"
        glow="radial-gradient(70% 55% at 50% 12%, rgba(143,24,36,0.5), transparent 70%)"
        className="py-16"
      >
        <Motes tint="#c98a5a" />
        <ScatteredBeans className="pointer-events-none absolute -right-16 top-20 hidden h-72 w-auto opacity-35 xl:block" />

        <div className="relative mx-auto w-full max-w-3xl px-6 sm:px-8">
          <h2 className="text-[clamp(1.625rem,4vw,2.25rem)] font-black tracking-[-0.02em]">
            Tres cafés, cinco etapas cada uno
          </h2>
          <p className="t-body mt-3 max-w-xl text-label-2">
            Cada receta se prepara distinto y se puntúa etapa por etapa.
          </p>

          <div className="mt-10 flex flex-col gap-6">
            {RECIPES.map((recipe, row) => {
              const photo = PHOTO[recipe.id];
              return (
                <article
                  key={recipe.id}
                  className="group squircle overflow-hidden rounded-card bg-[color:var(--color-cream)] text-[color:var(--color-cocoa)] shadow-[0_18px_44px_-28px_rgba(0,0,0,0.95)] transition duration-300 ease-sheet hover:-translate-y-1 hover:shadow-[0_30px_58px_-26px_rgba(0,0,0,0.9)]"
                >
                  {/* The glass takes one side and the recipe the other, and
                      the sides swap row to row so three of these in a column
                      read as a list rather than as one card printed three
                      times. */}
                  <div
                    className={`flex flex-col sm:flex-row ${
                      row % 2 === 1 ? "sm:flex-row-reverse" : ""
                    }`}
                  >
                    {/* The cup floats on the panel rather than filling it.
                        What sells that is the light behind it and the shadow
                        under it: with neither, a cutout reads as a sticker. */}
                    <div
                      className="relative flex h-56 w-full shrink-0 items-center justify-center overflow-hidden sm:h-auto sm:min-h-[16rem] sm:w-64"
                      style={{ background: recipe.colour }}
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0"
                        style={{
                          background:
                            "radial-gradient(52% 46% at 50% 42%, rgba(255,240,215,0.34), transparent 72%)",
                        }}
                      />
                      {photo && (
                        // Padded box first, then the image contained inside
                        // it, so no cup can ever reach an edge. The scale on
                        // top is optical only.
                        <span className="absolute inset-0 p-6">
                          <span
                            className="relative block h-full w-full transition-transform duration-500 ease-sheet group-hover:-translate-y-2"
                            style={{ transform: `scale(${photo.lift})` }}
                          >
                            <Image
                              src={photo.src}
                              alt={photo.alt}
                              fill
                              sizes="(max-width: 639px) 70vw, 260px"
                              className="object-contain drop-shadow-[0_16px_20px_rgba(20,4,2,0.5)]"
                            />
                          </span>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-1 flex-col p-6">
                      <h3 className="text-[1.5rem] font-black tracking-[-0.02em]">
                        {recipe.name}
                      </h3>
                      <p className="t-subhead mt-1 opacity-70">{recipe.blurb}</p>

                      <ol className="mt-4 space-y-2.5">
                        {recipe.stages.map((stage, i) => (
                          <li key={stage.id} className="flex gap-3">
                            <span
                              className="squircle mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-cocoa)]/10 font-mono text-[0.6875rem] font-bold tabular-nums transition-colors duration-300 group-hover:bg-[color:var(--color-tint)]/40"
                              aria-hidden
                            >
                              {i + 1}
                            </span>
                            <p className="t-caption leading-snug">
                              <span className="font-bold">{stage.title}.</span>{" "}
                              <span className="opacity-70">
                                {stage.instruction}
                              </span>
                            </p>
                          </li>
                        ))}
                      </ol>

                      <Link
                        href="/jugar"
                        className="t-footnote mt-5 inline-flex w-fit items-center gap-1.5 font-bold text-[color:var(--color-wine)] transition-colors duration-200 hover:text-[color:var(--color-cherry)]"
                      >
                        Preparar {recipe.name.toLowerCase()}
                        <span
                          aria-hidden
                          className="transition-transform duration-200 ease-sheet group-hover:translate-x-1"
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
        className="py-16"
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
          <h2 className="max-w-md text-[clamp(1.625rem,4vw,2.25rem)] font-black tracking-[-0.02em]">
            Cuatro gestos y ya
          </h2>
          <dl className="mt-7 grid gap-3 sm:grid-cols-2">
            {GESTURES.map((gesture) => (
              <div
                key={gesture.name}
                className="squircle rounded-card border border-white/10 bg-white/[0.06] p-4 transition duration-300 ease-sheet hover:-translate-y-0.5 hover:border-[color:var(--color-tint)]/50 hover:bg-white/[0.12]"
              >
                <dt className="t-footnote font-bold text-[color:var(--color-tint)]">
                  {gesture.name}
                </dt>
                <dd className="t-footnote mt-1 text-label-2">{gesture.says}</dd>
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
        </div>

      </Field>

      {/* -------------------------------------------- footer, on the deep */}
      <Field tone="deep" curve="hill" className="pb-10 pt-8">
        <div className="relative mx-auto flex w-full max-w-3xl flex-wrap items-center justify-between gap-4 px-6 sm:px-8">
          <p className="t-caption max-w-lg text-label-3">
            Modelos de{" "}
            <a
              href="https://kenney.nl"
              className="text-label-2 underline decoration-[color:var(--color-tint)]/50 underline-offset-2 transition-colors duration-200 hover:text-[color:var(--color-tint)] hover:decoration-[color:var(--color-tint)]"
              target="_blank"
              rel="noreferrer noopener"
            >
              Kenney
            </a>{" "}
            bajo CC0. Manos del kit de perfiles de entrada WebXR, MIT. Fotos de
            los cafés por{" "}
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
            </a>{" "}
            en Unsplash.
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
