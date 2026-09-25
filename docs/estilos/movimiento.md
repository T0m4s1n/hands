# Movimiento

`app/globals.css:98-169`.

## La regla

`:98-104`:

> Todo lo de aquí anima **sólo transform y opacity**, que el compositor puede
> hacer sin tocar layout ni pintado, y **todo se detiene en seco** para quien
> haya pedido a su sistema menos movimiento.

## Los keyframes

| Nombre | 0 % / 100 % | 50 % | Quién lo usa |
| --- | --- | --- | --- |
| `field-breathe` | `scale(1)`, opacidad 0.8 | `scale(1.14)`, opacidad 1 | El resplandor de cada `Field`, 14 s |
| `mote-drift` | en su sitio | `translate3d(var(--dx), var(--dy), 0) rotate(var(--dr))` | Las motas, 15–26 s |
| `sway` | `rotate(-1.4deg)` | `rotate(1.4deg)` | Las ramas: 13 s, 17 s y 15 s |
| `hover-bird` | `rotate(-2.5deg)` | `translate3d(-8px,-15px,0) rotate(2.5deg)` | El colibrí, 4.5 s |
| `steam-rise` | opacidad 0.35 | `translateY(-5px) scaleY(1.14) skewX(7deg)` | Vapor de la taza en `CameraGate` |
| `title-float` | `translateY(0)` | `translateY(-12px)` | El titular del permiso |
| `cup-sob` | `rotate(-5deg)` | `rotate(5deg)` | La taza cuando llora |
| `tear-fall` | opacidad 0 | `translateY(40px)`, opacidad 0 | Las lágrimas |
| `sync-wave` | `rotate(-5deg)` | `rotate(5deg) translateY(-8px)` | La palma mientras espera |
| `sync-finger` | `rotate(-4deg)` | `rotate(4deg)` | Cada dedo, desfasado |
| `sync-ring` | `scale(1)`, opacidad 0.2 | `scale(1.1)`, opacidad 0.42 | El halo al trabar |

Los comentarios de cada uno valen por sí solos:

- `mote-drift`: "A mote drifts from wherever it was placed to a nearby offset
  and back."
- `sway`: "**A branch has weight; it leans rather than bobbing.**"
- `hover-bird`: "The bird holds station the way a hummingbird does: small,
  quick, never still."
- `steam-rise`: "Steam leans and thins as it goes, rather than sliding straight
  up."

## Desfase

Las animaciones que se repiten llevan **retardo negativo**, para que no arranquen
todas a la vez:

- Las ramas: `-4s` y `-7s`.
- Las motas: `animationDelay: ${i * -2.6}s`, así que las ocho empiezan a mitad de
  ciclo y desacompasadas en el primer pintado.

Ocho cosas latiendo al unísono se leen como un parpadeo; desfasadas se leen como
aire.

## Movimiento reducido

**Hay dos bloques**, y el segundo hace redundante al primero.

`:164-169` — estrecho y dirigido:

```css
[style*="animation"], .grain::after { animation: none !important; }
```

Éste es el que atrapa las decoraciones, porque todas ponen `animation` por
atributo `style` en línea.

`:331-339` — global, cinturón y tirantes:

```css
*, *::before, *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

## Transiciones

Todo lo interactivo usa `--ease-sheet` (`cubic-bezier(0.32, 0.72, 0, 1)`) y
duraciones de 200 ms (controles), 300 ms (tarjetas) o 500–700 ms (fotografías).

Los `hover` de la portada combinan tres cosas a la vez: elevación
(`hover:-translate-y-1`), sombra que crece, y una flecha que se desplaza
(`group-hover:translate-x-1`).

## El iris

`app/globals.css` (`.iris-wipe`) y `components/flow/IrisWipe.tsx`.

Un velo con un agujero (`--iris` + `mask-image`). El radio es `72vmax`
abierto y `0` cerrado, para que el círculo se vea casi todo el trayecto
(con porcentaje, el agujero era más grande que la pantalla hasta el
último instante). El borde es un degradado (`--iris-soft`, `16vmax`) que
se aprieta a 0 al cerrar. **Cierra** de afuera hacia adentro (880 ms),
se queda 120 ms en negro, y **abre** de adentro hacia afuera (1040 ms).
Es la excepción a «sólo transform y opacity»: un iris no se puede hacer
sin máscara. `Countdown` usa `iris-count-pop` (720 ms) para el 3-2-1:
llega grande, se queda, se va.

## Dos cosas anotadas tal como están

1. **`steam-rise` tiene una sola definición** y la usa el vapor de
   `CameraGate`. Se escribió para un vaso dibujado que se sustituyó por
   fotografías; la taza del permiso lo recupera.
2. **Los dos bloques de `prefers-reduced-motion`** se solapan.
