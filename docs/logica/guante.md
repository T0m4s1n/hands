# El guante

`components/GloveHand.tsx` (949 líneas). El archivo más complejo del proyecto.
Toma 21 landmarks y posa un modelo articulado con ellos.

## Los modelos

Dos glTF de `@webxr-input-profiles/assets` (MIT), los mismos que usa three para
WebXR: `/models/hand-left.glb` y `/models/hand-right.glb`.

**Se cargan los dos** (`:21-27`) "because which one a hand needs is measured from
the landmarks, not assumed: the camera is mirrored, and a mirror turns a right
hand into a left one".

Cada instancia clona con `SkeletonUtils.clone` (`:586-598`); posar el caché de
`useGLTF` sería mutar estado compartido.

## El rig

`buildRig` (`:386-479`) lee la **pose de reposo desde las matrices inversas de
bind del skeleton**, no de los huesos vivos, "so it stays correct even though the
scene gets posed every frame" (`:322-335`).

Construye una base de modelo con `up = nudilloMedio − muñeca` (cuya longitud es
`modelSpan`), `across = nudilloMeñique − nudilloÍndice`,
`normal = across × up`, `side = up × normal`. El sentido de la palma sale del
signo del desplazamiento del pulgar sobre `normal`, porque "`normal` points out
of the palm on one model and out of the back on the other (the two glTFs are
mirror images)" (`:414-420`).

- `frustumCulled = false` — los huesos se alejan mucho del bind pose y si no la
  mano desaparece.
- `castShadow = true` — "The shadow on the table is what tells the player how
  close their hand is".

`CHAINS` (`:68-103`) mapea cada hueso al par de landmarks que abarca el mismo
hueso anatómico. Metacarpos y puntas llevan `aim: null, limits: null` y se
quedan rígidos.

## Límites de articulación

`:37-57`:

| Tipo | splay | curl | hyper | cone |
| --- | --- | --- | --- | --- |
| `HINGE` | 0.06 | 1.95 | 0.1 | — |
| `KNUCKLE` | 0.38 | 1.65 | 0.22 | — |
| `TIP_JOINT` | 0.06 | 1.5 | 0.1 | — |
| `THUMB_BASE` | | | | 1.25 |
| `THUMB_MID` | | | | 1.45 |
| `THUMB_END` | | | | 1.5 |

Sin límites "landmark noise bends fingers sideways and backwards and the result
looks like a horror prop". El pulgar usa cono y no bisagra porque "closing a hand
swings the thumb across the palm, which is opposition, not bending, and a hinge
plane simply cannot express it".

## El fotograma

1. **Objetivos.** Los 21 landmarks pasan por `landmarkToWorld` y luego **toda la
   nube se reescala alrededor de la muñeca** hasta que
   `|muñeca→nudilloMedio| = LOCKED_SPAN = 0.85` (`:630-638`). Dos razones: el
   tamaño en imagen crece y mengua con la distancia a cámara, y seguirlo hacía
   latir el guante y su alcance de agarre (`:116-119`); y "close hands feed
   oversized targets into a small rig and the fingers contort".
   Sin landmarks (sustituto de ratón) usa `REST_POSE` (`:124-146`), respirada y
   trasladada para que el punto medio pulgar/índice caiga en el cursor.
2. **Presencia.** `glove.shown` va a 0/1 con `showRate 14` al entrar y
   `hideRate 5` al salir. Bajo `SHOWN_FLOOR = 0.02` se oculta y se reinicia, para
   que reaparezca ya posada.
3. **Suavizado #2.** Ver abajo.
4. **Marca de palma** (`:726-747`). Se construye con los vectores **aplanados a
   z = 0**: "Depth noise used to flip the glove between faces; flattening keeps
   yaw stable. **Do NOT force a world-axis flip here** — that mirrors side/up and
   turns a right hand into a left one while the finger IK still aims at
   unmirrored landmarks (contortion)."
5. **Elección de modelo** (`:749-784`). Un cambio exige: estar siguiendo,
   confianza (`|across · up| < LAYOUT_CONFIDENCE 0.85`, porque casi de canto los
   dos ejes se juntan y el signo no significa nada), `LAYOUT_FRAMES = 6`
   fotogramas de acuerdo, y `SWAP_COOLDOWN = 0.6` s de bloqueo después.
   "This deliberately uses no depth. Depth is the axis this whole file has
   stopped trusting, and it was the last thing still deciding the model."
6. **Colocación** (`:786-818`). Escala `= (LOCKED_SPAN / rig.modelSpan) * shown`.
   La corrección de cara dorsal niega **dos** ejes — "that is a half turn about
   the hand's own up axis… Negating a single axis would mirror the hand."
7. **IK** (`:820-903`). Muñeca y metacarpos mantienen el bind pose, "so the palm
   is one rigid piece: its orientation comes from the palm frame above, which
   reads four landmarks and is far steadier than aiming each bone on its own".
   Cada cadena camina hacia fuera usando siempre las longitudes de hueso del
   modelo, así que la mano no puede estirarse.

## Suavizado #2

`:677-703`. Independiente del filtro del hook, con constantes propias:

```
rate        = stillRate 7 → movingRate 34   según speed / SPEED_FULL (3.2)
REST_RATE   = 2.6                            manos quietas
posFollow   = 1 - exp(-rate · dt)            X e Y
depthFollow = 1 - exp(-rate · depthDamping · dt)   depthDamping = 0.45
```

> **La Z va a menos de la mitad de ritmo que X e Y.** "Depth is the noisiest axis
> MediaPipe reports, so it gets damped harder."

Estas constantes viven en el objeto mutable exportado `handTuning` (`:185-199`),
"read at runtime so they can be dialled in against a live camera instead of
guessed at and rebuilt". Es lo que ajustan los mandos de `/manos`.

## La reconstrucción de profundidad

`trackedDirection` (`:481-511`) es el corazón del archivo y **no se fía de la Z
de MediaPipe**. Separa la componente perpendicular al eje de visión (fiable) y
**recalcula** la profundidad como el cateto que falta de un triángulo rectángulo
contra `restLength * fingerReach (0.82)`:

```
depth = sideways < reach ? sqrt(reach² − sideways²) : 0
```

con el signo de `depthSign`. El porqué: "a finger curling toward the camera
collapses into a near-zero vector that is mostly noise — which is exactly why
closing a fist fell apart… Of the two possible signs, take the one folding toward
the palm: the only way a finger actually bends."

`fingerReach` es generoso a propósito: "the player's proportions never match the
model's, and reading that as foreshortening would leave every finger permanently
half curled".

## Dos salvaguardas

- **`constrainDirection`** (`:519-574`): cuando una proyección degenera, el hueso
  **mantiene su dirección anterior**. "Falling back to the parent direction here
  snapped the finger straight for a frame, which is what the flicker during fast
  movement was."
- **`MAX_BONE_SLEW = 16` rad/s** por hueso (`:870-887`), saltado en el primer
  fotograma tras aparecer. "A finger closing fast covers maybe half this;
  anything beyond it is not a hand moving but the solve jumping."

## Invalidación del rig

`:714-722`. El rig se reconstruye cuando cambia el clon del que se leyó, porque
un rig apuntando a un clon descartado "poses bones nothing is skinned to any
more: the hand keeps rendering, frozen in its bind pose, and never animates
again".

## Materiales y puño

Un `MeshStandardMaterial` por guante (`:260-266`, roughness 0.62, metalness 0).
El color va de `GLOVE_RESTING #c9b9a4` a `GLOVE_TRACKED #f2e8d5` según presencia,
con emisivo hacia `GRAB_COLOR #f0b429` al agarrar. El tono en reposo es
deliberado: "Still cloth, just in shade — any browner and the glove reads as bare
skin".

El puño (`:907-917`) es un toro suelto, fuera del rig, teñido por mano
(`Left #d98c3c`, `Right #7a3b1e`) — "far enough apart in tone to tell at a
glance".

## Quiralidad

`handednessVolume` (`:346-365`): producto mixto normalizado de
`across × along · out`. "Measuring this beats assuming it: mirroring the camera
flips it, and a measured answer cannot fall out of step with a change made
somewhere else… near zero the hand is edge-on or the thumb is folded flat, and
the reading should not be trusted."

`handView` (`:207-213`) tiene dos interruptores de presentación:
`faceDorsal: true` ("Reaching onto a table you see the backs of your hands, so
this is what reads as your own hand") y `swapHands: false`.
