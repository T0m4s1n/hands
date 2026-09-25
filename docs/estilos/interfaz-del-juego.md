# La interfaz del juego

## `HandTrackedApp.tsx`

La escena se carga con `dynamic(..., { ssr: false })`.

El arranque es una secuencia, no un menú suelto. Cada tramo entra y sale
con un **iris** (`components/flow/IrisWipe.tsx`): el agujero se pinza de
afuera hacia adentro (880 ms), se queda 120 ms en negro, y se abre de
adentro hacia afuera (1040 ms). El borde va difuminado.

| Fase | Componente | Qué pide |
| --- | --- | --- |
| `sync` | `HandSync` | Una mano estable 0,9 s. Las dos, si se puede |
| `menu` | `RecipeMenu` | Carta: foto a sangre, tres nombres, hold o pellizco |
| `brief` | `Briefing` | Tres golpes de cómo se juega; se puede saltar |
| `count` | `Countdown` | 3 · 2 · 1 en el centro, al estilo Nintendo |
| `play` | `StageHud` | El minijuego |
| `results` | `Results` | Estrellas por proceso y una factura con el total |

### Las capas

| Capa | z | Qué es |
| --- | --- | --- |
| Escena | — | `absolute inset-0` |
| HUD de etapa | 10 | La barra de abajo |
| Fases de arranque / resultado | 20 | Sobre `gate-veil` (sync) o su propia capa |
| Permiso de cámara | 30 | Encima de las fases |
| Diagnóstico | 40 | Esquina |
| Iris | 50 | Cubre todo el wipe |

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

### La reseña y la factura

`components/flow/Results.tsx`. A la izquierda, cada proceso con su
instrucción y **estrellas** (`stars()`, los mismos umbrales que `grade()`).
A la derecha, una factura en crema: cabecera «La Mejor Taza», una línea
por etapa, TOTAL, la palabra de la nota. «Otra vez» vuelve a la cuenta
atrás; «Cambiar de café», al menú. Las dos con iris.

### El menú

`components/flow/RecipeMenu.tsx`. Una fotografía a sangre
(`recipeHero`, `/cafes/{id}-hero.jpg`) y un velo a la izquierda. Tres
nombres grandes: el de foco crece y enseña el `blurb`; a la derecha, el
`pitch` y las etapas, sin hoja. Dejar la mano 1,05 s pide el café; también
pellizcar o clic. Una raya ámbar se llena mientras espera.

### El permiso

`components/flow/CameraGate.tsx`. No hay hoja. Al montar pide la cámara
sola (`requestCamera()`). Mientras espera, el título «Café a mano» flota
y la taza echa vapor. Si el navegador deniega, no puede preguntar, o el
aviso se queda colgado más de 2,8 s, la taza llora, el título pasa a
«La taza no te ve», y salen **en fila** «Continuar con el ratón» y
«Aceptar cámara». El velo es un radial, no `scrim`: la sala se sigue
viendo.

El laboratorio (`/manos`) sigue usando `EnableCameraButton`.

### La sincronización

`components/flow/HandSync.tsx`. Tampoco hay hoja. «Sincronicemos» en
ámbar y «las manos» a flote, dos palmas SVG: saludan en espera, se tensan
al verse, cara y anillo ámbar al trabar. El texto de abajo dice si falta
una. Una palma estable 0,9 s basta; 0,55 s más y el iris abre el menú.

## `EnableCameraButton.tsx`

Sólo `/manos`. Un botón primario, un `plain` para «Continuar con el ratón»,
la pista de uso con ratón, y un `<details>` de diagnóstico cuyo `<summary>`
lleva `list-none` para matar el triángulo nativo.

> **Nota de idioma**: toda la interfaz de este componente está en español, pero
> las cadenas de `describeCameraError` en `hooks/requestCamera.ts` y el bloque
> de diagnóstico están **en inglés**.

## `DebugOverlay.tsx` (195 líneas)

El único sitio que se sale de la paleta de marca, porque dibuja sobre un canvas
de vídeo y necesita contraste:

| Para qué | Color |
| --- | --- |
| Esqueleto agarrando | `#4ade80` |
| Esqueleto suelto | `#67e8f9` |
| Landmarks del pellizco (4 y 8) | `#facc15`, radio 6 |
| El resto de landmarks | `#f8fafc`, radio 3.5 |

Los puntos verdes de `/manos` (`components/LandmarkDots.tsx`) corren el mismo
`poseCloud` que la mano — tamaño fijo, profundidad estirada, media vuelta
dorsal. Si se saltaba cualquiera de los dos últimos, los puntos se quedaban
en la palma y la mano mostraba el dorso: la única vista pensada para
separar tracking de dibujo no cuadraba con ninguno.

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
| Profundidad de la mano | 0–4 | «Más alto separa los dedos en profundidad y se tapan entre ellos» |

Y dos interruptores: **«Dorso hacia el jugador»** y **«Placa de palma»**. Los que había para elegir cara y modelo
desaparecieron con el rig: la mano se arma sobre los puntos, así que la
lateralidad sale sola. Un tercero, **«Mostrar puntos del tracking»**, enciende
los puntos verdes, que corren el mismo `poseCloud` que la mano.

Escriben sobre el objeto mutable `handTuning` de `RobotHand.tsx`, así que se
afinan contra una cámara viva sin recompilar. Ver
[../logica/mano.md](../logica/mano.md).
