# El kit y su registro

`components/coffee/kit.tsx` (350 líneas).

## La premisa

`:18-26`: la barra se monta con kits CC0 de Kenney "rather than modelled here",
y como

> Un kit está dibujado a su propia idea de escala y a su propia idea de qué lado
> es arriba, y **no hay dos kits que se pongan de acuerdo**,

cada modelo se **mide al cargar** y se ajusta al tamaño que su papel pide.
Cambiar una pieza es cambiar un nombre de archivo.

## `KitEntry`

`:28-52`:

| Campo | Qué es |
| --- | --- |
| `file` | Nombre del `.glb` |
| `dir` | Carpeta bajo `public/models`; por defecto `kit` |
| `size` | Tamaño final **en la dimensión más larga de las tres** |
| `yaw` | Giro sobre el eje vertical de la mesa |
| `lift` | Elevación sobre la barra |
| `back` | Alejamiento de la cámara, para piezas altas que taparían el objetivo |
| `hide` | Extras que el kit trae y esta escena no quiere |
| `shadows` | Por defecto `true` |

Ajustar por la dimensión más larga y no por el ancho (`:33-36`) porque hacerlo
por ancho "would make a tall narrow glass tower over everything and a flat
saucer disappear".

Sobre `shadows` (`:47-50`): sólo las piezas de barra lo necesitan,
"shadow-casting every plant and stool in the room costs real frames and buys
nothing at this distance".

`PropEntry` (`:59-68`) añade `solid` y `vessel`. Sobre `solid` (`:65`): escrito
por objeto desde el modelo ya ajustado "rather than wrapping everything in one
generous box: **that oversized box was why a spoon could not be set down beside
a cup.**"

## El registro

`KIT` (`:73-165`), de tipo `Record<PropKind, PropEntry | null>`:

| Pieza | Archivo | `size` | Collider | Masa / fricción |
| --- | --- | --- | --- | --- |
| `cup` | `cup-coffee.glb` | 1.2 | round r 0.42 h 0.5 | 1.6 / 0.6 |
| `mug` | `cup.glb` | 1.25 | round r 0.44 h 0.56 | 1.5 / 0.6 |
| `saucer` | `cup-saucer.glb` | 1.9 | **open** r 0.92 rim 0.7 | 1.2 / 0.7 |
| `grinder` | `mortar.glb` | 2.7 | **open** r 1.2 rim 0.95 | 5 / 0.9 |
| `crank` | `mortar-pestle.glb` | 1.15 | round r 0.17 h 1.1 | 1.1 / 0.5 |
| `scoop` | `cooking-spoon.glb` | 1.6 | **slab** 0.8 × 0.21 | 0.6 / 0.4 |
| `kettle` | `pot.glb` | 1.9 | round r 0.74 h 0.84 | 3.4 / 0.7 |
| `jug` | `carton.glb` | 1.15 | round r 0.23 h 1.1 | 1.9 / 0.5 |
| `filter` | `bowl.glb` | 1.6 | **open** r 0.68 rim 0.52 | 0.7 / 0.5 |
| `brewer` | `glass.glb` | 1.5 | round r 0.41 h 1.46 | 1.5 / 0.6 |
| `portafilter` | `frying-pan.glb` | 2.3 | **slab** 1.15 × 0.62 | 2.6 / 0.6 |
| `tamper` | `meat-tenderizer.glb` | 1.5 | **slab** 0.75 × 0.31 | 2.2 / 0.5 |
| `machine` | `kitchen-coffee-machine.glb` | 2.3 | round r 1.0 h 2.1 | 14 / 1 |
| `mat` | **`null`** | — | — | — |

Notas por pieza:

- Hay **dos tazas** (`:74-75`) "because one has to be able to fill up: the served
  one comes with its coffee modelled in, the empty one is what the liquid rises
  inside".
- El mortero con pistilo se eligió (`:97-98`) porque "grinding by turning in
  circles is exactly what the stage already asks the hand to do".
- La máquina (`:152-154`) lleva `hide: ["mug"]` — "The machine ships with a mug
  already under its spout; the game puts its own cup there" — y `back: 1.15`.
- El tapete es `null` (`:163`): "The mat is a circle painted on the tabletop, not
  an object."

## La medición, y por qué va desprendida

`KitModel` (`:257-331`). Contrato: "Everything inside sits on the tabletop,
centred on the group's origin, so callers only ever position the group."

Secuencia dentro del `useMemo` (`:282-318`):

1. `cloneSkinned(scene)` — "One clone per instance: the same cup shows up in
   several stages, and they must not share a transform".
2. `model.rotation.set(Math.PI / 2, 0, 0)` — "Kits are authored Y-up; this
   table's up is Z".
3. `tune(model, shadows)`.
4. Ocultar los nombres de `hide`.
5. `updateMatrixWorld(true)`; `box = new Box3().setFromObject(model)`.
6. `longest = max(size.x, size.y, size.z)`.
7. Guarda contra degenerados: `usable = isFinite(longest) && longest > 1e-3`, si
   no `console.warn("[kit] … has no measurable geometry; left unscaled")`.
   Lo que está en juego (`:303-306`): un modelo que no mide nada "would
   otherwise divide by almost zero and be scaled into a wall of triangles across
   the whole frustum, **which takes the renderer down rather than looking
   wrong**".
8. Devuelve `{model, scale: target/longest, offset: [-centre.x, -centre.y, -box.min.z]}`.

**El comentario clave** (`:261-266`):

> La medición ocurre mientras el clon sigue desprendido de la escena. Un `Box3`
> construido desde un objeto montado está **en espacio de mundo**, así que
> arrastra lo que sus ancestros le hayan hecho — mídelo después de montarlo y
> una pieza colocada en x = 1.85 se centra por 1.85 otra vez, **lo que tiró el
> mortero fuera de la mesa**.

Render (`:320-330`): grupo exterior con `position [0, back, lift]`,
`rotation [0,0,yaw]` y `scale`, envolviendo un grupo interior con el `offset`.
Orden: centrar en XY, apoyar en z = 0, escalar, girar, alejar.

## `PIECES`

`:333-343`. Las 13 piezas no nulas, ordenadas alfabéticamente. Vive aquí y no en
el laboratorio porque (`:336-338`) "the lab and its 3D scene both need it and
having one import the other made a cycle — **which in development resolved to
undefined and left the turntable empty**".

## Precarga y extras

`EXTRAS = { foam: { file: "whipped-cream.glb", size: 1.0 } }` (`:168`).
`ALL_FILES` junta todo y precarga en `:177`.

> **Dos cosas que anotar tal como están:** la precarga usa `url({ file })` **sin
> `dir`**, así que sólo precarga desde `/models/kit/`; y `whipped-cream.glb` se
> precarga pero **no se renderiza en ninguna parte**. `KitEntry.lift` está
> igualmente cableado de punta a punta pero ninguna entrada lo usa.
