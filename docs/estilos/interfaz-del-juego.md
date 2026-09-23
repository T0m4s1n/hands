# La interfaz del juego

## `HandTrackedApp.tsx` (443 líneas)

La escena se carga con `dynamic(..., { ssr: false })`.

### Las cuatro capas

| Capa | z | Qué es |
| --- | --- | --- |
| Escena | — | `absolute inset-0` |
| HUD de etapa | 10 | La barra de abajo |
| Menú / resultado | 20 | Sobre `scrim` |
| Permiso de cámara | 30 | Encima de todo |

La barra superior es `pointer-events-none` con los grupos de botones
reactivándolo, para no robar clics a la escena.

### El color de la nota

`markColour` (`:19-28`):

```
hsl(8 + safe*38, 85 - safe*16%, 42 + safe*18%)
```

De `hsl(8 85% 42%)` (óxido) a `hsl(46 69% 60%)` (oro).

> "It stays inside the warm half of the wheel so it never fights the scene, and
> **every bar it colours has its number beside it — colour alone is never the
> only way to read a score here.**"

### `StageHud`

La prioridad del mensaje (`:141-146`) es la lógica que más se nota jugando:

1. Si `hurry`: «Se acaba el tiempo — la etapa se cierra con lo que lleves»
2. Si hay mano cerca y no sostienes: «Pellizca para tomarlo»
3. Si no: la instrucción de la etapa

El color sigue la misma prioridad: naranja de aviso, ámbar de acento, o neutro.

La columna de título lleva `role="status" aria-live="polite"`.

Debajo, un `Meter` cuyo **valor es el avance y cuyo color es la calidad** — dos
cosas distintas a propósito — y el `Scorecard`: una barra por etapa, «where you
are, and what everything behind you scored».

### La hoja de resultado

`:322-381`. "**The brew is judged, never repeated.**"

Un `ScoreRing` con la nota sobre 100, la palabra de `grade()`, y las cinco
etapas con su `Meter` y su número. Dos botones: «Otra vez» y «Cambiar de café».

### El menú

`:384-407`. «¿Qué preparamos?» y tres `RecipeCard`.

`RecipeCard` (`:201-229`) es **un `<button>` entero**, no una tarjeta con un
botón dentro: "The whole card is the target, not a button inside it."

Al pie: «Pellizca con pulgar e índice para tomar. Abre la mano y la etapa se
cierra con el puntaje que lleves.»

### El permiso

`:409-440`. Hoja centrada con el glifo de taza, el título y un texto que cambia
según `loading`. Cierra con «El seguimiento corre en tu navegador. No se sube
nada.»

## `EnableCameraButton.tsx` (184 líneas)

Un botón primario, un `plain` para «Continuar con el ratón», la pista de uso con
ratón, y un `<details>` de diagnóstico cuyo `<summary>` lleva `list-none` para
matar el triángulo nativo (el anillo de foco global incluye `summary` a
propósito).

> **Nota de idioma**: toda la interfaz de este componente está en español, pero
> las cinco cadenas de `describeCameraError` (`:15-33`) y el bloque de
> diagnóstico están **en inglés**.

## `DebugOverlay.tsx` (195 líneas)

El único sitio que se sale de la paleta de marca, porque dibuja sobre un canvas
de vídeo y necesita contraste:

| Para qué | Color |
| --- | --- |
| Esqueleto agarrando | `#4ade80` |
| Esqueleto suelto | `#67e8f9` |
| Landmarks del pellizco (4 y 8) | `#facc15`, radio 6 |
| El resto de landmarks | `#f8fafc`, radio 3.5 |

Los puntos verdes de `/manos` (`components/LandmarkDots.tsx`) se dibujan **al
tamaño fijo del guante**, no al tamaño aparente con que los reporta la cámara.
Sin ese reescalado la superposición no puede hacer su trabajo: una mano cerca de
la cámara produce una nube mucho mayor que el guante de tamaño fijo, los dos
nunca cuadran, y **cualquier desacuerdo parece enorme haya o no algo roto**.

**Cuando está oculto el vídeo sigue montado** en un contenedor de 1×1 píxel con
`opacity-0` (`:102-110`): "The video element must stay mounted and playing (the
tracking hook reads frames from it), so it's kept off-screen rather than
unmounted."

El vídeo y el canvas van espejados con `scale-x-[-1]`.

Dos deslizadores: «Cierre del pellizco» (0.1–0.7) y «Apertura de la mano»
(0.16–1). Su color sale de la regla global de `accent-color`.

## `HandLab.tsx` (319 líneas) — `/manos`

Fondo `#141820`, **un gris azulado fijo, no `bg-canvas`**: el laboratorio se
sale a propósito del mundo vino.

Cuatro mandos (`KNOBS`, `:17-57`), cada uno con su pista:

| Mando | Rango | Pista |
| --- | --- | --- |
| Suavizado en reposo | 1–40 | «Más bajo quita temblor; demasiado bajo y la mano flota» |
| Suavizado en movimiento | 5–120 | «Más alto responde antes y deja pasar más ruido» |
| Amortiguación de profundidad | 0.05–1 | «La profundidad es el eje más ruidoso» |
| Inclinación de la palma | 0–1 | «Cuánta profundidad creerse al girar la mano; en 0 sólo gira de plano» |
| Zona muerta de dedos | 0.6–1 | «Más alto curva los dedos de más; más bajo no los curva» |

«Inclinación de la palma» en 0 reproduce exactamente el comportamiento viejo,
en el que la mano sólo podía girar en el plano de imagen. Es el mando con el que
comparar antes y después sin recompilar.

Escriben sobre el objeto mutable `handTuning` de `GloveHand.tsx`, así que se
afinan contra una cámara viva sin recompilar. Ver
[../logica/guante.md](../logica/guante.md).

Tres interruptores: mostrar puntos, dorso hacia el jugador, invertir elección de
modelo. Con la nota: «La cara mostrada y el modelo se eligen solos a partir de
los puntos. El interruptor de abajo solo hace falta si la regla salió
invertida.»
