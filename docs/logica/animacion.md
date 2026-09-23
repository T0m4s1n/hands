# Animación

`components/coffee/anim.ts` (90 líneas).

## Por qué muelles y no interpolación

El comentario de cabecera (`:1-12`):

> La interpolación lineal hacia un objetivo siempre parece una máquina
> soltando: empieza rápido, acaba lento, y nunca tiene inercia. Un muelle lleva
> velocidad… Es la mayor parte de la diferencia entre una interfaz que se mueve
> y un juego que se siente vivo.

## API

```ts
Spring = { value, velocity }
spring(value = 0): Spring
stepSpring(state, target, stiffness, dt, bounce = 0): number
setSpring(state, value)
approach(current, target, rate, dt): number
ease(t): number
pulse(since, length = 0.45): number
```

## `stepSpring`

`:36-55`:

```
damping = 2 * sqrt(stiffness) * (1 - bounce * 0.75)
```

"Critical damping is 2·sqrt(k); easing off it is what allows overshoot." Con
`bounce = 0` el muelle llega sin pasarse; subiéndolo, rebota.

Integración de Euler semi-implícita, **sub-dividida** en pasos de
`MAX_STEP = 1/45`, con el `dt` total recortado a 0.25.

`MAX_STEP` tiene el comentario que justifica todo el esquema (`:20-24`):

> Los tiempos de fotograma se disparan cada vez que la pestaña pasa a segundo
> plano o corre el recolector de basura, y **un muelle integrado sobre un paso
> largo se pasa lo bastante como para lanzar el objeto fuera de la mesa.**

## Las demás

- `approach(current, target, rate, dt)` (`:67-74`):
  `current + (target-current) * (1 - exp(-rate*dt))`. Independiente de la tasa
  de fotogramas.
- `ease(t)` (`:77-80`): smoothstep recortado `x²(3-2x)`.
- `pulse(since, length)` (`:86-90`): 0 fuera de `[0, length]`, si no
  `sin(t·π) * (1 - t*0.35)` — pico algo antes de la mitad, con cola que decae.

## Dónde se usan

En `CoffeeGame`: `lift` (altura, rigidez 150 sostenido / 90 libre, rebote 0.45 /
0.15), `grow` (escala, 170, rebote 0.4) y `swell` (cabezada de toda la escena,
90, rebote 0.55).

## Pruebas

`anim.test.ts`, 7 bloques:

- Se asienta en el objetivo.
- `bounce 0` no pasa de 1.002; `bounce 0.6` supera 1.05 y **aun así se asienta**.
- **Un único fotograma de 1,0 segundo con rigidez 400 y rebote 0.5 deja el valor
  finito y entre 0.5 y 1.6.** Éste es el que importa: una pestaña que vuelve de
  segundo plano entrega un segundo entero de golpe.
- Más rígido llega antes.
- `setSpring` pone la velocidad a cero.
- `approach` da el mismo resultado en 1 paso que en 30, con margen 1e-6.
- `ease` recorta en los dos extremos y `pulse` vale 0 antes y después, y nunca
  pasa de 1.
