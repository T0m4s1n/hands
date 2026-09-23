# El café y la multitud

## El local

`components/coffee/cafe.tsx` (347 líneas). "The room the counter stands in: a
stage with an audience behind it… **None of it is interactive, so none of it
casts shadows or is measured for collision.**"

Constantes (`:22-42`): `FLOOR_Z = -3.1`, `WALL_Y = 30.0`, `FRONT_Y = 10.4`,
`ROW_DEPTH = 2.9`, `ROW_RISE = 1.25`, `ROWS = 6`, `PER_ROW = 21` (126 asientos),
`SPACING = 1.8`, `HALL = 23`.

Sobre `SPACING` (`:33-37`): "Close enough that neighbours overlap. Spaced out,
the same figures read as a line of separate posts; **overlapping, they read as
one mass of people.**"

### Piezas

| Elemento | Líneas | Nota |
| --- | --- | --- |
| Suelo | 211-214 | Un plano de 70×60. "A plane rather than tiled models: it is a flat colour either way, and one mesh instead of a hundred" |
| Grada | 216-235 | Cinco cajas en `#1e0a10` como **una pendiente oscura**, no escalones. "Nobody can see the floor under a crowd in the dark, and the boxes that were there before were the biggest, brightest thing in the frame" |
| Barandilla | 239-252 | `#f5990a`, metalness 0.7, con dos postes |
| Telón de fondo | 254-259 | Plano en `#16040a`. "Without something behind them the far rows dissolve into the background colour" |
| Conos de luz | 261-288 | Tres, `openEnded`, `AdditiveBlending`, opacidad 0.028, `depthWrite={false}` |
| Chispas lejanas | 290-307 | 26 puntos colocados por un hash `sin(i*12.9898)*43758.5453` |
| Pancartas | 152-190 | CAFÉ · BARISTA · TINTO |
| Colgantes | 315-344 | Tres lámparas |
| `WINGS` | 65-80 | 13 muebles de decorado en los laterales |

### Los conos de luz

`:261-288`. "**This is the one addition that does more for how the room looks
than anything else in it**… It writes no depth, so it never hides anything behind
it."

Sobre su orientación: "Apex at the lamp, mouth on the counter. Turned the other
way it was a funnel widening into the ceiling, **which is why the first attempt
whited out the top of the frame**."

### Las pancartas

`bannerTexture(text)` (`:84-140`) dibuja un `CanvasTexture` de 640×200: fondo
`#8f1824`, filete `#f5990a` de 3 px, un glifo de taza con vapor en `#f0e8d9`, y
el texto en `600 58px system-ui` centrado.

Por qué canvas: "Cloth with lettering on it is the one thing in this room that
has to say a word, and a word is a texture… **changing what the banner says is
changing a string.**"

Por qué 640×200 y no cuadrado: "A square texture stretched over a wide banner
squashes the lettering, **which is what happened first**."

La colocación (`:142-151`) tiene el comentario más largo del archivo: colgadas
altas y al fondo no se veían nunca, "and the arithmetic says why: the camera
sits low and looks down, so at the crowd's distance the top of the frame is only
a couple of units off the floor".

La textura va como `map` **y** como `emissiveMap`, porque "a banner at the back
of a dark hall that is not lit is not a banner, it is a rectangle".

### Las lámparas

`:315-344`. Cordón, pantalla (cono `openEnded`, `#8f1824`, `side={2}` o sea
`DoubleSide`) y una esfera de filamento `#fff0cf` con emisivo `#ffc46b` a 3.2 y
`toneMapped={false}` — "what makes it read as lit rather than as a brown cone
hanging in the dark".

"**The glow is the lamp; the light itself is rigged in the scene so the two can
be tuned apart.**"

## La multitud

`components/coffee/crowd.tsx` (210 líneas).

### No son modelos, y ése es el punto

`:18-31`, el mejor comentario del archivo:

> El primer intento usó un kit de personajes de bloques, y en una sala oscura a
> esta distancia **un personaje de bloques es una caja** — cabeza cuadrada,
> hombros cuadrados, sin estrechamiento — así que noventa de ellos se leían como
> un montón de cajas y no como personas. Lo que hace que una silueta se lea como
> humana es el contorno: cabeza redonda, hombros que caen, un cuerpo que se
> estrecha. **Dos primitivas lo consiguen donde falló un kit entero.**

`silhouette()` (`:107-129`): una `CapsuleGeometry(0.4, HEIGHT*0.6, 3, 10)` girada
más una `SphereGeometry(0.224, 10, 7)`, soldadas con `mergeGeometries`. "A
capsule for the body, because its rounded top gives shoulders without modelling
any."

### Una sola llamada de dibujo

Un `instancedMesh` con una geometría y un `MeshLambertMaterial` blanco
(`:135-146`, `:203-209`). El color por instancia se pinta una vez con
`setColorAt` (`:160-174`):

```
shade.setRGB(0.055 + tone*0.16, 0.06 + tone*0.17, 0.075 + tone*0.2)
```

Blanco de base y no negro: "at near-black the outline vanished and the crowd read
as a row of posts".

### Colocación

`buildSeats` (`:65-105`). Las filas retroceden y suben; las impares se desplazan
media plaza "so nobody is directly behind anybody else". Todo lleva temblor
repetible con `scatter(seed)` — "Repeatable noise, so the crowd is arranged the
same way every time".

`tone = (1 - row/rows)*0.55 + scatter*0.45`: "Rows further back sit deeper in the
haze… Against a single flat grey the crowd read as one dark texture; **a spread
of values is what separates it into people.**"

### El movimiento

`:176-199`. `crowdMood.cheerAt` es un singleton mutable de módulo que el juego
escribe al cerrar una etapa (`CoffeeGame.tsx:405`).

```
cheer = sin((since / CHEER) * π)        // CHEER = 2.2 s
sway  = sin(t * 1.4 + phase)
bob   = sway*0.04 + cheer*|sin(t*6 + phase)|*0.45
```

"A cheer that swells and dies away, rather than switching on and off."
"Idling they shift their weight; cheering they come off the floor."

La escala es `(build, build, 2 - build)` para que "nobody is a scaled copy of the
person beside them". Todo se escribe con objetos `Matrix4`/`Vector3`/`Quaternion`
reutilizados.
