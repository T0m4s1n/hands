# Asignación de manos

`hooks/handAssignment.ts` (74 líneas). Decide qué detección de este fotograma
es la misma mano que cuál del anterior.

## Por qué no basta la etiqueta de MediaPipe

El comentario de cabecera (`:13-26`) explica el problema entero:

> La lateralidad es una clasificación **por fotograma**, y se invierte cuando
> una mano se inclina o se sale a medias del cuadro. Fiarse de ella de un
> fotograma al siguiente teletransporta las dos manos por la escena a la vez.
> Dos detecciones pueden además volver con la misma etiqueta, y entonces una de
> ellas no tiene dónde ir y la mano a la que pertenecía se congela y desaparece.

## El algoritmo

Emparejamiento voraz por **el par globalmente más cercano** (`:39-58`):

1. Recorre todos los pares (mano seguida × detección libre).
2. Se queda con la distancia más pequeña de todas, si está por debajo de
   `matchRadius`.
3. Reclama ese par. Repite hasta que ningún par cumpla.

Ir mano por mano no sirve (`:36-38`): "would let whichever hand is considered
first walk off with a detection that sits far nearer the other one".

Las detecciones sobrantes caen a la etiqueta, o al lado contrario si el sitio de
su etiqueta ya está ocupado, o se descartan si los dos lo están (`:60-71`).

## Constante

`MATCH_RADIUS = 0.22` (`hooks/useHandTracking.ts:99-100`) — "How far a wrist may
travel between frames and still be the same hand". En unidades de landmark
normalizadas, distancia 3D.

## Qué se compara

La muñeca (landmark 0). De las manos seguidas se toma la **suavizada**, no la
cruda. Las detecciones entran como `{raw, wrist: raw[0], label}`, donde `label`
cae a `"Right"` para cualquier cosa que no sea literalmente `"Left"`
(`useHandTracking.ts:459`).

## Pruebas

`hooks/handAssignment.test.ts`, 11 casos. Cubre el caso que motivó el módulo:
dos detecciones con la misma etiqueta, y el emparejamiento global ganando a la
alternativa voraz mano por mano.
