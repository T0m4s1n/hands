# Sólidos y colisiones

`components/coffee/solid.ts` (210 líneas).

## Lo que no es

El comentario de cabecera (`:1-13`) empieza aclarándolo:

> Esto no es un motor de cuerpos rígidos y no pretende serlo. Las manos mueven
> cada objeto directamente, así que un solucionador que empujara objetos estaría
> peleando con el jugador en vez de servirle. Lo que hace en su lugar es la
> lista corta de cosas que de verdad iban mal: objetos flotando sobre la
> superficie donde se dejaron, objetos metidos unos dentro de otros, y que todo
> se sintiera ingrávido.

## Formas

```ts
Shape = { kind: "round", radius, height }
      | { kind: "slab",  halfLong, halfShort, height }
      | { kind: "open",  radius, height, rim, floor }
```

`open` existe para que se pueda dejar algo **dentro** — "the difference between
a cup on a saucer and a cup hovering over a mortar" (`:26-30`).

Un collider por objeto y no una caja para todos, porque "a box around a spoon is
mostly air, and **it was that air that kept things from being set down next to
each other**" (`:16-19`).

`Solid = {shape, mass, friction}`. La masa "Not kilograms — a ratio" (`:34-37`).

## Apoyo

`restOn(shape, base, dx, dy)` (`:67-86`):

- `round` → `base + height` dentro del radio.
- `slab` → prueba de caja alineada a ejes.
- `open` → dentro de `rim` cae a `base + floor`; entre `rim` y `radius` se posa
  en `base + height`; más allá, `null`.

`settleHeight(x, y, counter, supports)` (`:104-116`) es el máximo sobre los
apoyos, con suelo en `counter`. "A dropped object is never left where the hand
let go of it, it is always put down on something."

## Separación

`overlap(a, b)` (`:123-158`) devuelve `{dx, dy, by}` o `null`:

- `null` si están apilados (`a.z >= bTop - 1e-3` o al revés).
- `null` si un cuerpo está **enteramente dentro** del `rim` de un `open`.
- Si no, círculo contra círculo sobre `reach(a) + reach(b)`.

Co-ubicación exacta elige `(1, 0)` "rather than dividing by zero".

## La altura de transporte

`carryOver(carried, obstacle, x, y, low, approach = 0.6, clearance = 0.12)`
(`:194-210`):

```
touching = reach(carried) + reach(obstacle.shape)
gap      = hypot(x - obstacle.x, y - obstacle.y)
near     = clamp01((touching + approach - gap) / approach)
over     = obstacle.z + height(obstacle.shape) + clearance
return over <= low ? low : low + (over - low) * near
```

**Su comentario (`:174-193`) es la mejor explicación de diseño del repositorio.**
La profundidad por tamaño aparente

> era la única lectura del tracker sin un cero fiable… Las colisiones eran el
> síntoma visible más que un fallo aparte: `overlap` sólo separa dos cosas que
> están a la misma altura, así que un objeto cuya altura parpadeaba parpadeaba
> entrando y saliendo de ser sólido, y **atravesaba el borde que debería haber
> rodeado**.

La subida empieza `approach` antes de que las siluetas se toquen "so it reads as
lifting something over a rim rather than as a step".

## Peso

```
carryRate(mass)          = 18 / max(1, mass)
landingKick(mass, speed) = min(1.4, max(0, speed) * 0.09 * sqrt(max(1, mass)))
```

Masa menor que 1 no acelera nada.

## Pruebas

**`solid.test.ts`** — 6 casos con `node:test`. Escenario: mortero
`open{r 0.5, h 0.6, rim 0.34, floor 0.12}` a z 0.05 y cuchara `round{r 0.12, h 0.1}`.

1. Viaja a `low` cuando está a 6 unidades.
2. Salva `obstacle.z + height` cuando está justo encima.
3. Ya está subiendo 0.25 antes de la distancia de contacto.
4. **Es monótona no decreciente** al acercarse de 3 a 0.
5. Un tapete de 0.02 de alto nunca baja la altura de transporte.
6. `overlap` devuelve `null` a la altura que `carryOver` decide — la separación
   que antes peleaba con la mano ya no tiene nada que hacer.

**`physical.test.ts`** casos 8-15: alcance por forma, apoyo dentro y fuera,
vasijas abiertas llevando al suelo interior o posando en el borde, `settleHeight`
eligiendo el apoyo más alto, magnitud de separación, cuerpos co-ubicados dando
dirección unitaria finita, un pistilo dentro de un cuenco quedando en paz, y el
tope de 1.4 del golpe aguantando a velocidad 400.
