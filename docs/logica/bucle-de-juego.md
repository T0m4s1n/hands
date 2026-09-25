# El bucle de juego

`components/CoffeeGame.tsx` (982 líneas). Un `useFrame` que lo lleva todo.

## Constantes

| Nombre | Valor | Línea | Qué es |
| --- | --- | --- | --- |
| `GRAB_RADIUS` | 1.15 | 83 | Alcance. Coincide con el tamaño fijo del guante, no con el de imagen |
| `REST_Z` | 0.12 | 84 | Altura de la barra |
| `CARRY_LOW` | 0.42 | 95 | Altura de transporte sin nada que salvar |
| `POUR_LIFT_Z` | 1.15 | 100 | Suelo de altura al verter, para que se vea lo de abajo |
| `CRANK_Z` | 0.95 | 102 | Altura del pistilo durante toda la molienda |
| `PUBLISH_INTERVAL` | 0.08 s | 103 | Límite de publicación de estado |
| `TAMP_REST_Z` | 0.5 | — | Altura desde la que el martillo golpea |
| `SHAKE_THROW` | 0.45 | 111 | Amplitud del golpe de agitado |
| `STAGE_LIMIT` | 45 s | 122 | Reloj una vez tocado el objeto |
| `IDLE_LIMIT` | 60 s | 123 | Reloj antes de tocarlo |
| `HURRY_AT` | 8 s | 124 | Aviso de que se acaba |
| `MIN_EFFORT` | 0.04 | 127 | Bajo esto, soltar es dejarlo, no intentarlo |
| `OVERFLOW_GRACE` | 1.4 s | 130 | Cuánto se tolera que rebose |

Dos relojes, y el comentario dice por qué (`:113-121`): "Nobody repeats a stage
here, so nobody can be stuck in one either… reading a new stage is not the same
as fumbling one… **Neither runs while no hand is tracked, so losing the camera
never costs a stage.**"

## Orden del fotograma

`useFrame` (`:324-873`):

1. `dt = min(delta, 0.05)`.
2. **Si `!running`, salir.** Oculta anillo, halo, relleno, superficie, bandas y
   puntos guía, y **el reloj no avanza**. "A glowing target ring behind a menu is
   noise pretending to be information."
3. Crear estado si falta; leer `handsRef.current ?? []`.
4. Si cambió la receta o la ronda, reconstruir y salir.
5. Si `done`, publicar estado terminal y salir.
6. Avanzar `intro`; **`if (hands.length > 0) game.elapsed += dt`**.
7. Para `crank`, recalcular `pos` sobre un círculo de radio `CRANK_ARM = 1.05`.
   "The pestle never travels with the hand: it swings round the mortar, and the
   hand only decides how far round it has got."
8. Barrido de agarre.
9. Resolver `holder`; `released` si soltó **o si se perdió la mano** — "Letting
   go, or losing the hand entirely, both end the attempt the same way."
10. Rama de sostenido: conducción por tipo de etapa + comprobación de rebose.
11. Rama de soltado.
12. Comprobación de tiempo agotado.
13. Bloque de dibujo.
14. Publicar `onStatus` si cambió algo o pasaron 80 ms.

Cualquier `commit(...)` sale del fotograma inmediatamente.

## Agarre

`handObjectDistance` (`:234-240`) es la distancia **plana** (sólo XY) mínima del
objeto al cursor de la mano *o* a cualquiera de los 7 `handGrabPoints`.

El agarre salta en flanco de subida (`grabbing && !wasGrabbing[hand] && !holder`)
y sólo si `reach < GRAB_RADIUS`. Al agarrar:

- `grow.velocity += 6` — "A grab should feel like a catch: throw the scale past
  its target and let the spring pull it back."
- Captura `grabAngle = hand.roll ?? palmAngle(smoothedLandmarks)` y pone `tilt` a
  cero. "Every measurement starts from where the hand was at the pinch, so the
  player never has to hold it at some particular angle first."

## Transporte

`:496-549`. El objeto **persigue** la mano, no se pega a ella:

```
follow = carryRate(masa)        // 18 / max(1, masa)
pos.x  = approach(pos.x, holder.cursor.x, follow, dt)
```

"Carried objects chase the hand instead of snapping to it, which hides the
jitter that is always present in tracking — and heavy ones chase it more slowly,
which is most of what makes them feel heavy."

Luego: `rideHeight = carryOver(...)` decide la altura, y `overlap(...)` separa de
lado si hace falta, con empuje suavizado
`push = min(hit.by, hit.by * 12 * dt + 0.004)` — "so it reads as sliding along
the rim, not as an invisible wall".

Ver [solidos-y-colisiones.md](solidos-y-colisiones.md).

## Altura

`:659-687`:

```
restingHeight = crank ? CRANK_Z : settleHeight(pos.x, pos.y, REST_Z, supports)
carryHeight   = crank ? CRANK_Z
              : tilt  ? max(POUR_LIFT_Z, rideHeight)
              :         rideHeight
stepSpring(lift, held ? carryHeight : restingHeight,
                 held ? 150 : 90, dt, held ? 0.45 : 0.15)
```

El caso `crank` tiene su propia nota (`:673-677`): mantener una altura toda la
etapa en vez de heredar "a stale carry height from the last stage", que
"started the grind at the wrong depth".

## Cada tipo de etapa

| Tipo | Cómo se conduce | Cómo se puntúa |
| --- | --- | --- |
| `place` | Nada por fotograma | `placeScore(reach, radius)` al soltar o al agotarse el tiempo |
| `crank` | `driveCrank` hacia `atan2(cursor − target)`; un salto persigue a tope, no para el mango | `bandScore` |
| `hold` | Dentro del anillo, `amount += rate * dt` | `bandScore` sobre nivel 0..1 |
| `tamp` | Clip `tampPose` (alza, slam, giro). El tracker sólo dispara; el clip termina solo | `bandScore` |
| `shake` | `updateStroke(stroke, cursor.x, SHAKE_THROW)`; cuenta cada cambio de sentido | `bandScore` |
| `tilt` | `tilt = angleDelta(grabAngle, roll)`, `flow = pourFlow(tilt)`, `amount += flow * rate * dt` | `bandScore` |

El prensado es un clip de `tampPress.ts`, no un stroke de la webcam. Llevar
el martillo sobre el portafiltro dispara alza → slam → giro. Tres golpes,
el último más fuerte, y el set se acaba aunque el tracker parpadee.

La jarra de `shake` se tambalea al ritmo del golpe. Un sacudido que sólo
subía un contador se leía como un número que crecía sin motivo.

Los puntos guía ya no son sólo de `place` en reposo: un `crank` marca el
círculo del mortero, y `hold` / `tilt` / `tamp` dibujan el arco hacia la
marca mientras el objeto viaja. Se ocultan al llegar — un camino a donde
ya estás es ruido.

## Rebose

`:596-605`, para `hold` y `tilt`. Al llegar `amount >= 1` el exceso va a
`spilled`, `amount` se fija en 1 y `overflowing += dt`. Pasado
`OVERFLOW_GRACE` se cierra la etapa con `bandScore(1, band)`.

> "Cutting the stage off the instant it filled hid the mistake; letting it run
> over shows the player what they did, **and the puddle stays there afterwards.**"

## `commit`

`:396-431`. Apila la nota, copia a `published` (copia nueva "so React sees the
change"), pone el origen del estallido en la etapa — "Praise lands where the
work happened, not at some fixed spot" — avisa a la multitud
(`crowdMood.cheerAt = time`), avanza de etapa y reinicia los acumuladores.

El objeto de la etapa siguiente entra con `setSpring(grow, 0.55)`: "The next
stage's object drops in rather than appearing."

## El golpe de aterrizaje

`:688-699`. Cuando algo no sostenido llega a su altura de reposo bajando a más
de 0.4:

```
kick = landingKick(masa, -velocidad)
grow.velocity  -= kick * 4
swell.velocity += kick * 0.5
if (lleva líquido) splash(slosh, 0, 0, kick * 0.9, 4)
```

"A cup put down hard rocks whatever is in it."

## La nota final

**No se calcula aquí.** `components/HandTrackedApp.tsx:30-33` hace la media
simple de `marks`, y `:336` la pasa por `grade()`.
