# Seguimiento de manos

`hooks/useHandTracking.ts` (634 líneas). Dueño de la cámara, del modelo de
MediaPipe y del bucle por fotograma.

## La cámara no se pide aquí

`getUserMedia` vive en `hooks/requestCamera.ts`. Pide de forma deliberadamente
redundante: `{video: true}`, `{video: {}}` y una petición por cada dispositivo
enumerado, **las tres a la vez**. `keepFirstStream` resuelve con `Promise.any`,
para los tracks de las perdedoras y quita el audio de la ganadora. En `/jugar`
lo llama `CameraGate` al montar; en `/manos`, el clic de `EnableCameraButton`.

Los errores se traducen por estado del dispositivo (`:19-33`):
`NotAllowedError`, `NotReadableError`/`AbortError`,
`NotFoundError`/`OverconstrainedError`.

El `MediaStream` resultante se entrega a `useHandTracking().start(stream)`.

## Carga del modelo

`useHandTracking.ts:44-49`:

```
WASM_URL   https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm
MODULE_URL https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs
MODELOS    float16/latest → float16/1 → float32/1
```

El fotograma se prepara en `handFrame.ts` (espejo, 640 px, filtro de luz)
y los esqueletos rotos se tiran en `handQuality.ts`.

`loadMediaPipe()` (`:160-165`) importa el módulo con
`new Function("url", "return import(url)")` — un import dinámico que el bundler
no puede ver ni reescribir.

Opciones del landmarker: `runningMode: "VIDEO"`, `numHands: 4` (candidatos),
luego `selectPersonHands` deja **como máximo dos** y de **una sola persona**.
`minHandDetectionConfidence: 0.32`, `minHandPresenceConfidence: 0.42`,
`minTrackingConfidence: 0.42` — un close-up recorta las yemas y bajaba
la presencia por debajo de 0.55, que es lo que mataba el molino. Se
intenta cada modelo en GPU y se cae a CPU.

**Invalidación de sesión por contador**: `stop()` incrementa
`sessionRef.current`, y cada frontera `await` vuelve a comprobar `stillActive()`
(`:363`, `:373`, `:378`, `:399`). Un `start` viejo cierra el landmarker que
acaba de crear en vez de instalarlo.

## El bucle por fotograma

`tick()`, sobre `requestAnimationFrame`: publica el guante cada
refresco e infiere 20–36 veces por segundo, según cuánto tarde el
modelo. Inferir en cada fotograma de cámara congelaba la página.

1. `dt = Math.min(0.1, (now - lastTick) / 1000)` — tiempo real transcurrido,
   "so the smoother settles in the same wall-clock time whatever the frame rate
   happens to be".
2. Sale y se reprograma si `readyState < 2`.
3. `setFrameShape(videoWidth, videoHeight)` cada fotograma.
4. Se salta la detección si `video.currentTime` no ha cambiado.
5. Marca de tiempo monótona: `Math.max(performance.now(), lastTimestamp + 1)`.
6. **Espeja el cuadro** y detecta sobre el espejo.
7. `detectForVideo` dentro de un `try/catch`; si lanza, se salta el fotograma.

### El espejado, una sola vez

`mirrorFrame` (`:279-301`) reutiliza un canvas fuera de pantalla con
`ctx.setTransform(-1, 0, 0, 1, width, 0)`. Sin contexto 2D devuelve el vídeo sin
voltear: "costs the mirror but keeps tracking alive".

Es **el único espejado de toda la aplicación** (`:436-440`), y además hace que
las etiquetas de lateralidad lleguen como MediaPipe las documenta, porque el
detector ya asume un cuadro tipo selfie.

## De landmark a mundo

`screenFromHand(hand)` convierte una mano a 0..1 sobre la pantalla, para
los menús. Si hay landmarks, usa la yema del índice; si es el ratón,
deshace `landmarkToWorld` con las mismas constantes.

`landmarkToWorld(lm)` (`:226-238`):

```
x = (lm.x - 0.5) * WORLD_X                             WORLD_X = 7
y = (0.5 - lm.y) * worldY                              worldY = WORLD_X * (alto/ancho)
z = HAND_HOVER + clamp(-lm.z * WORLD_Z, -0.7, 0.7)     HAND_HOVER = 0.95, WORLD_Z = 1.4
```

- **Sin volteo en X** (`:210-211`): el cuadro ya venía espejado. Comprobado
  contra la superposición de landmarks en crudo.
- **Y se invierte** porque la Y de imagen crece hacia abajo.
- **`worldY` es estado mutable de módulo** (`:79`), con `WORLD_X * 0.75` como
  suposición 4:3 inicial, actualizado por `setFrameShape`. El comentario
  (`:74-78`) explica lo que está en juego: los landmarks se normalizan por
  ancho y alto por separado, así que los dos ejes sólo llevan la misma
  distancia física cuando se divide la forma del cuadro. Hacerlo mal aplasta la
  mano en un eje, "which then reads as foreshortening and curls fingers that
  are in fact straight".
- **`WORLD_Z` y el recorte a ±0.7**: la profundidad por landmark se conserva
  "only for the shape of the fingers — a curled finger really does sit nearer
  than a straight one… **It never decides how high the hand itself is.**"

### `HAND_HOVER` es fijo, y es la decisión más importante del archivo

El comentario (`:86-98`) es el registro de un sistema retirado. La altura venía
del tamaño aparente de la mano contra un rango que la sesión aprendía sobre la
marcha, "which meant the hands, and everything they were holding, slowly
breathed up and down with nothing but tracking noise behind it".

> A camera pointed at a person cannot measure distance; it can only measure how
> big they look, and inferring one from the other needs a scale nobody supplies.
> Two steady axes the player controls beat three where the third argues with
> them.

Ver [solidos-y-colisiones.md](solidos-y-colisiones.md) para qué ocupó su lugar.

## Suavizado

`smoothLandmarks(prev, next, dt)` (`:189-206`). Devuelve `next` tal cual si no
hay previo o si las longitudes no coinciden.

```
travelled = hypot(next[0].x - prev[0].x, next[0].y - prev[0].y)   // muñeca, 2D
moving    = min(1, travelled / MOVING_SPAN)                        // 0.045
rate      = STILL_RATE + (MOVING_RATE - STILL_RATE) * moving       // 14 → 90
t         = 1 - exp(-rate * min(dt, 0.1))
out[i]    = lerp(prev[i], next[i], t)
```

Dos propiedades, las dos deliberadas (`:51-62`):

- **Adaptativo a la velocidad.** Una mezcla fija suaviza igual una mano que
  cruza el cuadro que una apoyada en la barra, "so fast movement arrives late —
  the lag people actually feel — while slow movement still shimmers".
- **Independiente de la tasa de fotogramas.** Por fotograma en vez de por
  segundo, "the same setting behaves differently at thirty and at a hundred and
  twenty".

Una sola velocidad para toda la mano, medida en la muñeca, porque "smoothing the
fingers at different rates from the palm pulls the hand apart when it moves"
(`:196-197`).

> **Hay un segundo filtro.** La mano suaviza otra vez, en espacio de mundo,
> con las mismas constantes (`stillRate 16`, `movingRate 90`,
> `depthDamping 0.75`). Se aplican **en serie**, y dos filtros exponenciales
> encadenados suman sus constantes de tiempo — los valores de la mano eran 7 y
> 34, que hacían de ese filtro el cuello de botella. Ver [mano.md](mano.md).

## Pellizco

`pinchMetrics(landmarks)` (`:243-258`), sobre los landmarks **ya suavizados**:

```
handSize      = max(dist(muñeca, nudilloMedio), 1e-4)   // 3D
pinchDistance = dist(puntaPulgar, puntaÍndice) / handSize
cursor        = landmarkToWorld(punto medio muñeca↔nudilloMedio)
```

El cursor es la **palma**, no el punto medio del pellizco: "tips jitter more and
drift off the visual glove once hand size is locked" (`:250-251`).

`applyHysteresis` (`:260-267`): si ya agarra, sigue agarrando mientras
`pinchDistance < exit`; si no, empieza cuando `pinchDistance < enter`. Por
defecto `{enter: 0.32, exit: 0.52}` (`:71`). `setThresholds` (`:330-338`) fuerza
`enter ≤ exit - 0.04` y recorta a `[0.08, 0.8]` y `[0.12, 1.2]`.

Sin histéresis el agarre parpadea justo en el umbral.

## Manos fantasma

`PersistedHand = {smoothed, isGrabbing, missed}` (`:167-171`, `:482-514`).

Una mano vista reinicia `missed = 0`. Una no vista lo incrementa, se borra a los
`DROP_AFTER_MISSED_FRAMES = 8` (`:68`) y **hasta entonces se vuelve a publicar**
con los landmarks suavizados viejos, el pellizco recalculado sobre ellos y el
`isGrabbing` intacto.

Sin esto, un fotograma perdido suelta lo que el jugador tenía en la mano.

## El sustituto del ratón

`enablePointerFallback()` (`:557-615`) llama a `stop()` y pasa a `"ready"` sin
cámara. Publica exactamente una mano, siempre `"Right"`, con arrays de
landmarks **vacíos**:

```
cursor.x      = (clientX / innerWidth  - 0.5) * 7
cursor.y      = -(clientY / innerHeight - 0.5) * worldY
cursor.z      = HAND_HOVER
pinchDistance = grabbing ? 0.12 : 0.8
isGrabbing    = (event.buttons === 1)
roll          = acumulador de la rueda
```

La rueda gira la muñeca: `roll = clamp(roll + deltaY * 0.004, -1.6, 1.6)`.
Existe porque "a mouse has no wrist, so the roll a pour needs has to come from
somewhere else… Without it the fallback could not tip a jug, which left two of
the three recipes impossible to finish without a camera" (`:563-566`).

La rueda **ya no sube ni baja la mano** (`:580-582`): "nothing does now, because
the game works out that height for itself".

Los arrays vacíos hacen que el guante caiga a `REST_POSE` y que el juego sólo
vea el cursor.

## Lo que exporta

```ts
export type TrackedHand = {
  handedness: Handedness;      // "Left" | "Right"
  landmarks: Vec3[];           // crudos, o suavizados viejos en un fotograma fantasma
  smoothedLandmarks: Vec3[];
  cursor: Vec3;                // mundo, centro de la palma
  pinchDistance: number;       // normalizado por tamaño de mano
  isGrabbing: boolean;
  roll?: number;               // sólo el sustituto de ratón
};
```

`roll` es opcional a propósito (`:17-21`): con cámara hay que leerlo de los
landmarks, así que ahí se deja sin poner.

El hook devuelve (`:623-633`):
`{ videoRef, handsRef, hud, status, error, thresholds, setThresholds, start, enablePointerFallback }`.

`handsRef` es un **ref**. Sólo `hud`, `status`, `error` y `thresholds` son
estado de React, y el HUD se publica como mucho cada 80 ms.

`TrackingStatus` = `"idle" | "requesting-camera" | "loading-model" | "ready" | "denied" | "error"`.
