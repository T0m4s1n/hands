# Líquidos

`components/coffee/liquid.ts` (182 líneas).

## Volumen, no porcentaje

El comentario de cabecera (`:1-12`):

> Una vasija contiene un volumen, no un porcentaje. Mantenerlo así es lo que
> hace que verter se comporte: la jarra pierde exactamente lo que la taza gana…
> y el rebose es un número real de mililitros que tiene que ir a alguna parte,
> en vez de un nivel que se detiene calladamente en 1.

## Los cinco líquidos

`LIQUIDS` (`:33-74`):

| Tipo | Color | Crema | Rugosidad | Opacidad | Grosor |
| --- | --- | --- | --- | --- | --- |
| `coffee` | `#3a1d0e` | `#c98f5a` | 0.16 | 1 | 1 |
| `espresso` | `#241006` | `#b87a45` | 0.12 | 1 | 1.15 |
| `water` | `#9fc4d8` | — | 0.05 | **0.42** | 0.75 |
| `milk` | `#f6f1e8` | — | 0.55 | 1 | 1.2 |
| `foam` | `#fffaf0` | — | 0.9 | 1 | 1.6 |

> "Each liquid gets its own surface, because «café, agua o leche» should be
> obvious at a glance without reading the HUD."

## Geometría de vasija

```ts
Vessel = { radius, floor, depth }              // unidades de mundo
capacity(v)               = π · r² · depth
surfaceHeight(v, volume)  = floor + clamp01(volume / capacity) · depth
fillRatio(v, volume)
```

## Verter

`pour({from, into, room, amount})` (`:124-152`):

```
leaving  = min(amount, from)
accepted = min(leaving, room - into)
spilled  = leaving - accepted
```

Los tres cortes, nombrados en el comentario: "the jug can run dry, the cup can
fill up, and the tilt can be too shallow to pour at all. **Whatever the cup
cannot take is spilled rather than quietly deleted.**"

## El chorro

`GRAVITY = 9.2`. `streamPoint(start, velocity, t)` es un arco balístico con
`−½gt²` en Z. `fallTime(height, upwardSpeed = 0)` es la raíz positiva
`(v + sqrt(v² + 2gh)) / g`, y devuelve 0 si `height <= 0`.

> "An arc is most of what makes it read as liquid rather than a drawn line."

## Lo que el juego usa hoy, y lo que no

**`CoffeeGame.tsx` no llama a `pour`, `capacity`, `fillRatio`, `surfaceHeight`,
`streamPoint` ni `fallTime`.** Lleva un `amount` de 0 a 1 directamente y usa su
propia tabla local `VESSELS` (`CoffeeGame.tsx:138-146`) para la geometría. De
este módulo importa sólo `LIQUIDS` y `LiquidKind`.

`kit.tsx` sí adjunta registros `Vessel` a las piezas, pero el modelo de volumen
no está conectado al bucle de etapas.

Está anotado aquí porque es la clase de cosa que se descubre tarde y mal: el
módulo está probado y funciona, pero hoy es una biblioteca en espera, no el
camino activo.

## Pruebas

`physical.test.ts` casos 1-7 ejercitan igualmente la API de volumen:
aritmética de capacidad y nivel incluido el recorte por exceso; **conservación**
(`from + into + spilled` invariante para cantidades 0 / 0.01 / 0.3 / 5 y
partidas 0 / 0.4 / 1); jarra vacía y taza llena; unicidad de color y
distinciones de opacidad, crema y grosor; y que `streamPoint` en `fallTime(1)`
aterriza exactamente en z = 0.
