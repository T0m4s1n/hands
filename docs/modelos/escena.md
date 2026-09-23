# La escena

`components/HandTrackedScene.tsx` (341 líneas).

## El Canvas

`:288-311`:

```
shadows="percentage"
dpr={[1, 1.75]}
camera={{ position: CAMERA_HOME, fov: 46 }}
gl={{ antialias: true, alpha: false,
      powerPreference: "high-performance",
      toneMapping: NoToneMapping }}
```

El ángulo de cámara tiene su razón (`:291-294`): "flatter shows more café but
squashes the axis the hands move along, so reaching stops mapping one to one.
**Roughly forty degrees above the counter keeps both honest.**"

`NoToneMapping` es la corrección de un fallo, no una preferencia. Ver
[post-proceso.md](post-proceso.md).

## Encuadre

`TABLE_Z = -0.34`, `CAMERA_HOME = (0, -6.4, 6.0)`,
`CAMERA_TARGET = (0, 0.95, 0.85)`, `FRAMED_FOR = 16/10` (`:17-24`).

`FitToWindow` (`:32-45`) multiplica `CAMERA_HOME` por
`pull = clamp(FRAMED_FOR / aspect, 1, 2.1)`:

> El campo de visión de una cámara de three es **vertical**, así que una ventana
> alta y estrecha ve menos mesa a lo ancho que una ancha… Retirar la cámara
> recto por su propia línea de visión devuelve esa anchura sin el ojo de pez que
> traería un objetivo más abierto.

## Fondo y niebla

`:98-104`: fondo `#1c050a` y `fog ["#1c050a", 13, 27]`.

"Warm shadow rather than black… **a pure black background is what made it read
as a void.**" La niebla disuelve todo lo que pase de la segunda fila.

## Luces

`:106-174`:

| Luz | Posición | Intensidad | Color |
| --- | --- | --- | --- |
| `hemisphereLight` | — | 0.24 | `#6b3a44` / `#1a0509` |
| `ambientLight` | — | 0.22 | `#d8b9a8` |
| `spotLight` (sombras) | `[0, 1.6, 7.2]` | 190 | `#ffcf8a` |
| `pointLight` ×2 | `[±5.4, -1.2, 3.4]` | 34 | `#f5990a` |
| `directionalLight` | `[0, 26, 16]` | 1.15 | `#a86a78` |
| `directionalLight` | `[0, -6, 9]` | 0.45 | `#f5990a` |

El foco es el único que proyecta sombra: `angle 0.72`, `penumbra 0.55`,
`distance 26`, `decay 2`, mapa 1024², `shadow-bias -0.0006`,
`shadow-normalBias 0.02`.

Los dos puntos de relleno existen "so the props are not lit from a single point
and nothing on the bar falls into its own shadow". La direccional fría del fondo
ilumina al público "so the warm stage reads as the warm thing in the room"; la
cálida baja le da profundidad "instead of being one flat cut-out".

El comentario en `:118-126` enumera **lo que se quitó**: la luz de día por las
ventanas, el rebote del suelo y el relleno del lado del jugador. Menos luces
también es menos compilación de shaders.

## Entorno

`:176-214`. `<Environment resolution={128} frames={1}>` con cuatro
`Lightformer`:

| Forma | Color | Intensidad | Posición |
| --- | --- | --- | --- |
| rect | `#ffdcae` | 4 | `[0, 2, 7]`, escala 10×6 |
| rect | `#cfe2ff` | 3 | `[-7, 9, 6]` |
| rect | `#ffb877` | 1.6 | `[6, -3, 3]` |
| ring | `#fff2dd` | 2.4 | `[2, 3, 6]`, escala 3 |

`frames={1}` lo cuece una sola vez. "A handful of glowing rectangles gives them
that for the cost of one small cube render."

## La barra

`:218-251`. Un `RoundedBox` de 13.4 × 6.6 × 0.44 en `#7b4a33`, un panel frontal
que baja hasta el suelo, una barra de latón (`#f5990a`, metalness 0.8) y un
tapete `RoundedBox` en `#45291c` que "keeps the play area readable against the
wood".

## Orden de render

`:216-266`: `<Cafe />` → barra → `<CoffeeGame />` → `<Suspense><HandGloves /></Suspense>`
→ **`<GradePass />` el último, "because it takes over the render loop"**.

## `GraphicsGuard`

`:47-80`. Escucha `webglcontextlost` y `webglcontextrestored`.

Llama `event.preventDefault()` al perderlo — "**Without this the browser will not
even try to give it back**" — e `invalidate()` al recuperarlo.

Mientras tanto muestra una hoja de recuperación (`:321-338`): «Se perdió el
contexto gráfico» / «El navegador soltó la tarjeta gráfica. Suele volver solo;
si no, recarga la página.»

El porqué (`:47-55`): "A browser can take the WebGL context back at any time —
the machine sleeps, the driver resets, another tab is greedy — and when it does,
three stops drawing and **the canvas is left as a blank rectangle with no
explanation**."
