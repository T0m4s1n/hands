# Oleaje

`components/coffee/slosh.ts` (179 líneas). La superficie del líquido se mueve
resolviendo la ecuación de onda.

## Por qué

> "Un disco plano que cambia de altura es un indicador. Lo que lo hace leerse
> como líquido es que responde."

## El método

Diferencias finitas explícitas sobre `∂²u/∂t² = c²∇²u` en una rejilla cuadrada
pequeña. "Solved the usual explicit way: the next height comes from the current
one, the previous one, and how much the neighbours disagree with the middle."

```ts
Slosh = { size, now, was, next }   // tres Float32Array, "Scratch, so a step allocates nothing"
createSlosh(size = 16)             // el juego usa 16
```

## El paso

`stepSlosh(state, dt, speed = 0.32, damping = 0.06)` (`:52-83`):

```
steps = clamp(round(dt * 90), 1, 3)
c     = min(MAX_SPEED, max(0, speed))          // MAX_SPEED = 0.42
keep  = 1 - clamp01(damping)

next = now + (now - was) * keep + ((L+R+U+D) * 0.25 - now) * c * 2
```

**Bordes reflectantes**: el índice del vecino se recorta a sí mismo en el límite
— "the wall of the cup is what a ripple bounces off".

`MAX_SPEED` tiene su propio comentario: "Above about 0.5 the explicit solver
stops being stable and the surface explodes into noise… **a wobbling cup of
coffee is not worth a NaN.**"

`dt` se dobla en el número de sub-pasos, **nunca se usa como coeficiente
directo**. Ésa es la diferencia entre estable e inestable.

## La salpicadura

`splash(state, x, y, strength, spread = 1.6)` (`:98-144`). Un núcleo de coseno
alzado `0.5 + 0.5·cos(away·π)` sobre el disco de radio `spread`, **con la media
restada** y reescalado por `1/max(1e-3, 1-mean)` para que el núcleo **sume
cero**.

El razonamiento (`:92-97`) es el error que costó encontrar:

> Las paredes de una taza reflejan, lo que significa que la simulación conserva
> lo que le metas, así que una salpicadura que sólo empujara hacia abajo se
> extendería hasta dejar toda la superficie permanentemente más baja y sin
> volver nunca. Desplazar en vez de quitar es además lo que hace un impacto
> real.

Por eso `strength` equivale exactamente a la profundidad del hoyo.

## Lectura

`sampleSlosh(state, x, y)` — bilineal en espacio −1..1, índices recortados.
`agitation(state)` — media de `|altura|`, "for deciding when it has gone still".

## Uso

El juego llama `stepSlosh(…, 0.3, 0.05)` cada fotograma y `splash` en las gotas
del vertido y en los aterrizajes duros. `components/coffee/props.tsx:180-203`
desplaza con `sampleSlosh` los vértices de un disco.

## Pruebas

`slosh.test.ts`, 8 bloques:

- Superficie en calma: `agitation === 0` tras 200 pasos.
- Una salpicadura hunde el centro bajo −0.4 y el borde lejano se queda bajo 0.05.
- El desplazamiento del borde **crece** tras 20 pasos: la onda viaja, no aparece
  en todas partes a la vez.
- Tras 600 pasos la agitación baja del 5 % de su pico.
- **400 iteraciones de salpicaduras grandes con fotogramas alternos de 1,5 s,
  velocidad 5 y amortiguación 0,02 dejan todas las celdas finitas** — "a NaN
  here spreads to every vertex of the mesh".
- El muestreo es suave entre celdas y finito fuera de la rejilla.
- `calmSlosh` pone a cero el historial.
- Dos salpicaduras son estrictamente más ruidosas que una.
