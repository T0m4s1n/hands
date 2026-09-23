# Gestos

`components/coffee/gestures.ts` (139 líneas). Detectores puros: números entran,
números salen. Sin React, sin three.

## Todo trabaja en el plano de imagen

El comentario de cabecera (`:1-12`) es la razón de ser del módulo:

> MediaPipe reporta profundidad a aproximadamente un quinto de la escala de los
> otros dos ejes y con mucho más ruido, así que un gesto que pidiera al jugador
> empujar hacia o desde la cámara se puntuaría sobre todo por el temblor.

## API

```ts
TILT_START = 0.45
TILT_FULL  = 1.15

angleDelta(from, to): number
palmAngle(landmarks): number
pourFlow(tilt): number
newTurn(angle): TurnState        updateTurn(state, angle): number
newStroke(value): StrokeState    updateStroke(state, value, amplitude): number
```

## `angleDelta`

`:31-36`. El camino más corto, envuelto a −π..π con bucles `while`. Sin esto,
cruzar la costura de π cuenta como un giro casi completo.

## `palmAngle`

`:44-49`. `atan2` del landmark 9 menos el 0, en XY. Devuelve 0 si falta alguno.

Se usa muñeca→nudillo medio porque "is the longest line across the hand, so it
is also the steadiest".

## `pourFlow`

`:56-60`. Cero hasta `|tilt| > TILT_START`, luego lineal hasta 1 en `TILT_FULL`.
Simétrico en signo.

> "Holding it level pours nothing, which is what lets a player stop."

## `updateTurn`

`:77-84`. Acumula `|angleDelta|` en `turned` **sin importar la dirección**, así
que girar la manivela en cualquier sentido cuenta.

Un paso mayor que `MAX_TURN_STEP = 0.6` rad (`:26-28`) se rechaza como salto del
tracker — "nobody cranks a handle at thirty-odd radians a second" — pero el
`angle` guardado **sí** avanza, para no acumular deuda.

## `updateStroke`

`:110-139`. Lleva `dir` (+1/−1/0), `extreme` (el punto más lejano en ese sentido)
y `count`.

- Desde reposo, un movimiento de `≥ amplitude` empieza el primer golpe.
- Moviéndose igual, `extreme` se arrastra.
- Una inversión cuenta **sólo** cuando el valor ha vuelto `amplitude` desde
  `extreme`.

Devuelve la dirección del golpe que **acaba de empezar**, o 0. "The caller can
therefore count every stroke (shaking) or only the ones going one way
(pressing down)."

Ese detalle es lo que permite que agitar cuente todo y prensar cuente sólo lo
que baja, con un único detector.

## Pruebas

`gestures.test.ts`, casos 1-9:

- Cruce de la costura en π.
- Un giro cuenta las dos direcciones: 0→0.5→0.1→0.4 suma 1.2.
- Un salto de 2.4 rad no suma nada pero `angle` avanza igual.
- Geometría de `palmAngle`, y `palmAngle([]) === 0`.
- `pourFlow` en 0, START, FULL, −FULL y 3×FULL; el punto medio exacto da 0.5.
- Agitar cuenta un golpe por cambio de sentido: 3 en una secuencia guionizada.
- **200 fotogramas de temblor de ±0.03 cuentan 0.**
- Una deriva en un solo sentido es exactamente 1 golpe.
- Prensar cuenta 3 golpes hacia abajo de 5 cambios de sentido totales.
