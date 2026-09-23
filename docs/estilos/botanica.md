# Botánica

`components/Botanical.tsx` (258 líneas). Tres dibujos en SVG en línea.

## Por qué

`:1-13`:

> La Mejor Taza enmarca cada página con el mismo borde botánico, y es lo más
> reconocible del diseño. **El color solo no basta: un rectángulo vino plano es
> sólo un rectángulo vino plano hasta que algo crece dentro de él desde los
> bordes.**

En SVG en línea y no como imágenes "so it scales to any screen, takes its colours
from the same tokens as everything else, and costs nothing to load".

> En la práctica los colores son constantes JS que **duplican** los hex de las
> variables CSS en vez de leerlas.

## Colores

| Constante | Hex |
| --- | --- |
| `LEAF` | `#1f7a3d` |
| `LEAF_DARK` | `#14572b` |
| `CHERRY` | `#d8232a` |
| `CHERRY_DARK` | `#9c1119` |
| `BEAN` | `#4a2a17` |
| `WING` | `#c2186f` |
| `WING_DEEP` | `#8d0f4e` |
| `BODY` | `#15803d` |
| `BODY_DEEP` | `#0d5c2a` |

## Las primitivas

**`Leaf`** (`:26-53`). Ancho = `length * 0.34`. Dos curvas cuadráticas cerradas,
puntiaguda por los dos extremos, con nervio central dibujado en el tono
**contrario** al relleno.

> "Pointed at both ends with a midrib down the middle — the shape a coffee leaf
> actually has, and **the reason it reads as coffee rather than as a generic
> plant.**"

**`Cherry`** (`:55-72`). Un círculo, un arco de media luna en el tono oscuro al
45 % para el lado en sombra, y un punto especular en `#ff7b74`.

**`Bean`** (`:74-95`). Una elipse `ry = rx * 0.68` con el pliegue central como
trazo cuadrático.

## `CoffeeBranch`

`:101-150`. `viewBox="0 0 220 340"`. Un tallo leñoso, 8 hojas alternando tono
(longitudes 72–104, inclinaciones −48° a +62°) y 7 cerezas.

**El volteo es una decisión documentada** (`:112-114`):

> Una rama volteada se espeja **aquí dentro** y no con una clase de utilidad,
> para que una animación pasada desde fuera pueda seguir siendo dueña de
> `transform` en el elemento que la lleva — el espejo va en el grupo interior.

Implementación: `<g transform={flip ? "translate(220 0) scale(-1 1)" : undefined}>`.

Por eso la portada puede pasarle `sway` como `style` en línea sin pelearse con
un `-scale-x-100`.

## `ScatteredBeans`

`:159-182`. Seis granos de tamaño 23 a 34.

> "**Drawn big.** At a size where you have to look for them they read as specks
> of dirt on the screen; at this size they read as coffee, which is the only
> reason they are here."

## `Hummingbird`

`:198-258`. `viewBox="0 0 260 200"`.

> Es la marca sobre la que La Mejor Taza construye sus carteles — alas magenta,
> cuerpo verde, siempre suspendido junto al texto — **y lo único que hace que un
> rectángulo verde se lea como esta marca y no como cualquier otro rectángulo
> verde.**

Orden de dibujo, cada parte con su comentario: ala lejana en `WING_DEEP`
"behind the body and darker, so it has some depth"; cola en dos abanicos;
cuerpo; garganta en `WING` — "the bright patch a hummingbird catches the light
with"; cabeza con ojo y el pico largo y recto; y el ala cercana "swept up and
caught mid-beat".
