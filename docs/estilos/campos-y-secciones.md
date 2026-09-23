# Campos y secciones

`components/Field.tsx` (141 líneas). El componente que resuelve el problema
central del diseño de la portada.

## El problema

`:1-19`:

> Cada sección posee un color en exclusiva, que es lo que da ritmo a la página.
> La dificultad siempre fue la unión: **dos rectángulos planos encontrándose son
> una línea trazada a través de la página, y una línea trazada se lee como un
> error, no como un cambio de tema.**

## La solución

> Un campo **no empieza en su propio borde superior**. Hace crecer un labio curvo
> hacia arriba dentro de lo que tenga encima, pintado de su propio color, y el
> cambio de suelo ocurre a lo largo de esa curva. **El ojo lee una forma — algo
> vertido, o una colina — en vez de un borde, y a los dos colores se les permite
> ser tan distintos como quieran.**

## Tonos

`:21-28`. `Tone` = `"wine" | "roast" | "forest" | "deep"`, uno a uno con las
variables `--field-*`.

## Las curvas

`:30-44`. Tres perfiles, "because the same curve three times down a page stops
being a gesture and starts being a border style".

| Clave | Comentario | Usada por |
| --- | --- | --- |
| `roll` | "A long, lazy roll — the gentlest of the three" | La sección verde |
| `pour` | "Off-centre and steeper on the left, like liquid finding a level" | La sección tostada |
| `hill` | "Two shallow crests, for the quietest join" | El pie |

## El mecanismo del solape

`:62-75`. Dos cajas, con responsabilidades opuestas:

- El **envoltorio exterior** es `relative` y **no recorta**: "Not clipped, so the
  lip can reach up out of the section."
- La **sección interior** lleva `overflow-hidden`: "The clipping that keeps the
  leaves off the words happens on the section inside."

El SVG de la curva es `absolute bottom-full left-0` con
`viewBox="0 0 1440 120"` y `preserveAspectRatio="none"`, relleno del color del
**propio** campo. `bottom-full` es lo que lo empuja hacia arriba dentro de la
sección anterior.

Alturas: 40 px móvil, 64 px `sm`, 80 px `lg`.

`curve` se omite en el primero, "which has nothing above it to grow into".

## El resplandor

`:80-90`. Sólo si se pasa `glow`. Ocupa todo el campo, con
`animation: field-breathe 14s` y `transformOrigin: 50% 20%`. "A lit pool inside
the field, in whatever colour suits it."

## Las motas

`:97-141`:

> Las posiciones están escritas a mano, no aleatorizadas: **un diseño que se
> rebaraja en cada render es un diseño que nadie puede corregir**, y éstas están
> puestas para no invadir la columna de texto.

Ocho motas con `left`, `top`, `size`, `--dx`, `--dy`, `--dr` y duración propios
(15 a 26 s). Cada una es un `span` redondo con `height = size * 0.7` — **elipses,
no círculos**, o sea granos vistos de lejos — a `opacity: 0.16`.

El tinte por defecto es `#f0e8d9`, el hex de la crema escrito a mano en vez de
leído de la variable.

## Cómo se usa

En `app/page.tsx`, cuatro campos en orden:

1. `wine`, sin curva — el héroe
2. `roast`, curva `pour` — las recetas
3. `forest`, curva `roll` — los gestos
4. `deep`, curva `hill` — el pie

El `<main>` lleva `bg-[color:var(--field-deep)]`: el color base de la página es
el del **último** campo, así que el rebote del scroll muestra el final del
degradado y no negro.
