# Tokens y tema

`app/globals.css` (339 líneas). Tailwind v4, importado con `@import "tailwindcss"`
en la línea 1. **No hay `tailwind.config.js`**: todo vive en el bloque `@theme`.

## La tesis

`:3-9`. Un sistema de diseño pequeño «built the way Apple builds one»: una
**jerarquía de etiquetas** en vez de grises sueltos, **materiales translúcidos**
en vez de paneles planos, **un solo color de acento**, y una escala tipográfica
con nombres de verdad. Todo se apoya sobre una mesa 3D viva, así que

> "it is glass over the scene, never a wall in front of it."

## Cómo funciona `@theme`

Cada entrada se convierte a la vez en una variable CSS en `:root` y en un
espacio de utilidades de Tailwind: `--color-*` da `bg-*`/`text-*`/`border-*`,
`--radius-*` da `rounded-*`, `--ease-*` da `ease-*`.

## Colores de marca

`:19-36`. El comentario dice de dónde salen:

> Los colores de La Mejor Taza, Nariño: un vino profundo que lo carga casi todo,
> crema cálida para lo que haya que leer largo, ámbar para lo único que se
> pulsa, y marrón tostado debajo de todo. **Tomados del sitio, no inventados.**

| Token | Hex | Uso |
| --- | --- | --- |
| `--color-wine` | `#8f1824` | Enlaces de tarjeta, el logotipo |
| `--color-wine-deep` | `#5c0f18` | *definido, sin usar* |
| `--color-cream` | `#f0e8d9` | Fondo de las tarjetas de receta |
| `--color-amber` | `#f5990a` | *definido, sin usar; mismo hex que `--color-tint`* |
| `--color-cocoa` | `#522a1d` | Texto de las tarjetas |
| `--color-forest` | `#12664a` | *definido, sin usar* |
| `--color-forest-deep` | `#0b4a34` | *definido, sin usar* |
| `--color-leaf` | `#1f7a3d` | *duplicado como constante JS* |
| `--color-cherry` | `#d8232a` | Hover de enlace en las tarjetas |

Sobre el verde (`:30-34`): "La Mejor Taza alternates whole sections between the
wine and this, **so it is a surface colour in its own right and not just the
colour of the leaves.**"

## Los campos

`:38-51`. El comentario más determinante del archivo:

> Cada sección posee uno de éstos en exclusiva. Lo que evita que el cambio entre
> ellas se lea como un borde duro **no es mezclar los colores entre sí** — es que
> cada campo hace crecer un labio curvo hacia arriba dentro del de encima, así
> que la unión es una forma y no una línea. Y van ordenados para hundirse por lo
> oscuro en el medio. **Rojo y verde no tienen nada entre medias salvo barro,
> así que nunca se les pide que se encuentren a plena luz.**

| Token | Hex |
| --- | --- |
| `--field-wine` | `#8f1824` |
| `--field-roast` | `#2b1014` |
| `--field-forest` | `#0f5c42` |
| `--field-deep` | `#093b2b` |

Ver [campos-y-secciones.md](campos-y-secciones.md).

## Jerarquía de etiquetas

`:56-64`. Texto en prominencia descendente, **en blanco** para lo que carga la
página, "because the brand sets its headlines in plain white on the wine and they
are the loudest thing on it — with cream kept for surfaces rather than for type".

| Token | Valor |
| --- | --- |
| `--color-label` | `rgb(255 255 255 / 0.98)` |
| `--color-label-2` | `rgb(255 250 244 / 0.76)` |
| `--color-label-3` | `rgb(255 250 244 / 0.52)` |
| `--color-label-4` | `rgb(255 250 244 / 0.3)` — *sin usar* |

## Separadores y rellenos

`:66-70`. "Hairlines and the soft fills that stand in for buttons and tracks."

`--color-separator` `rgb(240 232 217 / 0.16)` ·
`--color-fill` `/0.09` · `--color-fill-2` `/0.16` · `--color-fill-3` `/0.24`

## Acento

`:72-75`. **"The single tint colour. Everything interactive is this, nothing else
is."**

`--color-tint` `#f5990a` · `--color-tint-ink` `#3d1206` ·
`--color-canvas` `#2b070c`

`--color-canvas` se repite literal como `themeColor` en `app/layout.tsx:18`.

## Radios y curva

`:77-81`:

| Token | Valor | Utilidad |
| --- | --- | --- |
| `--radius-card` | `1.25rem` | `rounded-card` |
| `--radius-sheet` | `1.75rem` | `rounded-sheet` |
| `--radius-tile` | `0.875rem` | `rounded-tile` |
| `--ease-sheet` | `cubic-bezier(0.32, 0.72, 0, 1)` | `ease-sheet` |

`--ease-sheet` se usa 14 veces. Es **la** curva del sistema.

## Base

`:84-96`. `body` toma `--color-canvas`, `--color-label`, `--font-sans`,
`-webkit-font-smoothing: antialiased` y `text-rendering: optimizeLegibility`.
Sobre los dos últimos (`:93`): "Apple's optical sizing on large text depends on
these being on."

## Un fallo vivo con las fuentes

```
--font-sans: var(--font-roboto), -apple-system, …
--font-mono: …, var(--font-geist-mono), monospace
```

**Ni `--font-roboto` ni `--font-geist-mono` están definidos en ninguna parte.**
`app/layout.tsx:5-9` carga **Poppins** bajo `--font-poppins`.

Resultado: Poppins se descarga y se pone en el `<html>`, pero nada la consume;
`font-sans` cae a `-apple-system`. Es una petición de red que no se usa.

Anotado aquí, sin corregir, porque esta documentación describe lo que hay.

## Tema

No hay tema claro. `app/layout.tsx:17-20` fija `colorScheme: "dark"` y
`themeColor: "#2b070c"`, y no hay ningún proveedor de tema en toda la aplicación.
