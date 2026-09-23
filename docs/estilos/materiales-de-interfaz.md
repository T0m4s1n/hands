# Materiales de interfaz

Cómo se hacen los paneles que flotan sobre la escena 3D.

## Cristal

`app/globals.css:191-229`. El comentario explica la técnica:

> Desenfoque **más saturación** es lo que hace que el cristal se lea como
> cristal y no como una caja gris: el color de lo que haya detrás se filtra y
> sigue vivo, así que el panel se siente una capa del mismo mundo.

| Clase | Fondo | `backdrop-filter` | Sombra |
| --- | --- | --- | --- |
| `.material` | `rgb(64 11 18 / 0.74)` | `blur(32px) saturate(180%)` | interior + exterior |
| `.material-thin` | `rgb(74 13 21 / 0.52)` | `blur(24px) saturate(170%)` | — |
| `.material-thick` | `rgb(46 8 14 / 0.93)` | `blur(32px) saturate(160%)` | igual que `.material` |
| `.scrim` | `rgb(26 4 8 / 0.62)` | `blur(26px) saturate(140%)` | — |

Las tres primeras llevan `1px solid var(--color-separator)`.

`.material-thick` es "For panels that carry a lot of text over a bright, busy
scene". `.scrim` es "The dimmed layer a sheet sits on, so the scene stays
legible underneath".

La regla al elegir: **el cristal sólo vale mientras se pueda leer lo que hay
escrito encima.**

## Grano

`:171-189`. `.grain` más un `::after` con `opacity: 0.18`,
`mix-blend-mode: overlay` y un SVG en data-URI de 180×180 con
`feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3"`.

> Color plano a este tamaño se lee como una pared sin pintar; un poco de ruido
> se lee como papel. **Generado en vez de descargado** — es un filtro, y una
> imagen sería una petición por algo que nadie debe notar.

Lo lleva cada `Field` de la portada (`components/Field.tsx:77`).

## Squircle

`:231-240`, dentro de `@supports (corner-shape: squircle)`. Una sola
declaración: `corner-shape: squircle`.

> Un `border-radius` normal es un arco circular que se encuentra con el borde
> recto haciendo un quiebro visible; un squircle se funde con él. Sólo algunos
> navegadores saben dibujarlo, **y el redondeado de repuesto está perfectamente
> bien.**

21 usos, y siempre acompañado de una clase `rounded-*`, para que el repuesto
funcione.

## Foco

`:306-316`:

```css
:where(button, a, input, summary):focus-visible {
  outline: 2px solid var(--color-tint);
  outline-offset: 3px;
  border-radius: 0.5rem;
}
```

"One focus ring everywhere, and it only shows for keyboard users." El `:where()`
mantiene la especificidad en cero, así que nunca hay que pelearse con ella.
Incluye `summary` a propósito, por el desplegable de diagnóstico.

`input[type="range"]` recibe `accent-color: var(--color-tint)` — "Range inputs
are the one native control kept, so they get the tint".

## La pastilla

`:281-303`:

```css
.pill {
  border-radius: 999px;
  background: var(--color-tint);
  color: var(--color-tint-ink);
  font-weight: 700;
  transition: transform, filter, box-shadow  220ms var(--ease-sheet);
}
```

> "The amber pill the brand puts its dates and labels in. **Dark type on amber
> rather than the other way round, which is how they set it.**"

`.pill-quiet` existe (fondo al 18 % con `color-mix`) pero no se usa en ninguna
parte.

## Los componentes

`components/ui.tsx` (172 líneas). "Having exactly one button, one panel and one
progress track keeps the app consistent by construction rather than by
remembering — **which is the only way consistency ever survives a redesign.**"

| Componente | Qué es |
| --- | --- |
| `Sheet` | El panel. `thick` para texto denso sobre escena brillante. Sin relleno propio |
| `Button` | `primary` / `secondary` / `plain` |
| `IconButton` | Redondo, 44×44, **exige `label`** (va a `aria-label` y `title`) |
| `Meter` | Barra de progreso con `role="progressbar"` |
| `ScoreRing` | El anillo de nota, radio 52, transición de 900 ms |

`TAP = "min-h-[2.75rem]"` (`:11-12`) — "44px is the smallest target a finger hits
reliably. **Nothing here is smaller.**"

Sobre `primary` (`:42-43`): "exactly one of these is on screen at a time, and it
is always the thing the person most likely came to do".

Sobre `Meter` (`:91-95`): `value` es cuánto llevas y `colour` es cómo de bien lo
llevas — "**deliberately two different things, because in this game you can be a
long way along and doing badly**".

> **Excepciones vivas al sistema**: la llamada a la acción de la portada usa
> `min-h-[3.25rem]` y no el componente `Button`; los interruptores de `/manos` y
> `/modelos` usan `2.25rem`; y la hoja de contexto perdido en
> `HandTrackedScene.tsx:321-337` compone `material-thick` a mano y reimplementa
> el botón primario.
