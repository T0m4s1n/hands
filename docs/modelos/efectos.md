# Efectos

`components/coffee/effects.tsx` (373 líneas).

## Por qué no son archivos

`:8-15`:

> Vapor, poso de café y un estallido de elogio cambian de forma en cada
> fotograma… así que ninguno puede ser un archivo en disco. **Son también lo que
> evita que una disposición ordenada de modelos parezca la foto de un catálogo.**

Comunes: `PARKED = new Vector3(0,0,-999)` para aparcar instancias fuera de
cuadro, `scatter(seed)` para ruido repetible, y una fábrica `scratch()` de
objetos reutilizables para no asignar nada por fotograma.

## Los cinco

| Efecto | Geometría | Material | Detalle |
| --- | --- | --- | --- |
| `Steam` | esfera 0.17, instanciada, 14 soplos | `meshBasicMaterial #ffeed6`, opacidad 0.17, `depthWrite={false}` | Escala `sin(life*π)*strength` |
| `Beans` | esfera 0.075, instanciada, 24, con sombra | `meshStandardMaterial #3b1f10` | Repartidos con `r = sqrt(a)*radius` |
| `Burst` | esfera 0.12, instanciada, 26 | `#ffd88a`, emisivo `#ffae2b` a 1.6, `toneMapped={false}` | Arco `lift = 2.4t − 3.0t²` |
| `PourStream` | esfera 0.095, instanciada, 16 cuentas | tintado al líquido, **`depthTest={false}`** | Caída `fall = t*t` |
| `Spill` | un círculo | opacidad 0.92 | Escala `sqrt(spilled)*2.6`, tope 1.15 |

## Las decisiones que importan

**Vapor.** Crece y desaparece en vez de desvanecerse: "Swells then vanishes: no
fade needed, and **no transparency sorting**." Su cantidad se lee de un ref cada
fotograma "so the game loop can turn it up as a cup fills without re-rendering
the scene".

**Granos.** La raíz cuadrada del radio "spreads them evenly over the disc instead
of crowding them into the middle".

**Estallido.** `firedAt` guarda la lectura del reloj; "setting it again replays
the burst". La trayectoria es "Thrown up and out, then pulled back down: **an
arc, not a starburst.**"

**Chorro.** Tres decisiones en una:

- `fall = t*t`, porque "Falling accelerates, so the beads bunch at the top and
  stretch out toward the landing".
- Un ancho mínimo, porque "A trickle scaled straight off the flow came out
  microscopic, **which read as no pour at all rather than as a slow one**".
- `depthTest={false}`, porque "A stream that disappears behind the jug pouring it
  tells the player nothing".

**Derrame.** Raíz cuadrada otra vez, "because a puddle spreads over an area
rather than a radius". Y no encoge nunca:

> "A puddle that cleans itself up would be telling the player their mistake did
> not matter."

## Dónde se montan

`CoffeeGame.tsx:920-980`. El objeto sostenido va dentro de `itemRef`; el vapor
se sitúa en `vessel.base + 0.34`; los granos extra aparecen al sostener la
cuchara y durante la molienda.
