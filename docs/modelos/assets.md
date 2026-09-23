# Assets

Todo en `public/`. **2,5 MB en total.**

```
public/
  cafes/            3 PNG recortados     608 KB
  models/
    hand-left.glb   92 KB
    hand-right.glb  92 KB
    kit/            14 .glb + CREDITS.md + Textures/colormap.png    192 KB
    cafe/           49 .glb + CREDITS.md + Textures/colormap.png    688 KB
    crowd/           8 .glb + CREDITS.md + Textures/ (8 PNG)        1,0 MB
```

## `models/kit/` — lo que el jugador toca

14 archivos. Fuente según `public/models/kit/CREDITS.md`: **Kenney, CC0 1.0**.
Once vienen de **Food Kit 2.0**; `kitchen-coffee-machine.glb` del **Furniture
Kit**.

`bowl` · `carton` · `cooking-spoon` · `cup-coffee` · `cup-saucer` · `cup` ·
`frying-pan` · `glass` · `kitchen-coffee-machine` · `meat-tenderizer` ·
`mortar-pestle` · `mortar` · `pot` · `whipped-cream`

Trece están en `KIT`; `whipped-cream` está en `EXTRAS`.

13 de los 14 referencian `Textures/colormap.png`; la máquina de café no (lleva
el color en el material). **El `CREDITS.md` avisa**: el glTF referencia la
textura por ruta relativa, así que "si se mueven de carpeta, hay que mover la
textura con ellos".

El `CREDITS.md` cierra con una sección «Lo que sí es código»: el café líquido,
la espuma que sube, el vapor, los granos y las chispas de acierto no son modelos
porque cambian de forma cada fotograma. **«Un archivo `.glb` no puede llenarse a
la mitad.»**

## `models/cafe/` — decorado

49 archivos del **Furniture Kit** de Kenney, CC0. Sólo decorado: no proyectan
sombra ni se miden para colisión.

**Sólo 13 de los 49 se colocan**, vía `WINGS` en `cafe.tsx:65-80`. Los otros 36
están en disco sin usar.

> El `CREDITS.md` de esta carpeta dice que los modelos no llevan textura, pero
> **9 de los 49 sí referencian `colormap`** (`bag`, `barrel`, `cake`, `cookie`,
> `croissant`, `cup-tea`, `donut`, `honey`, `mug` — piezas del Food Kit que
> acabaron aquí). Ése es exactamente el caso para el que se escribió la clave de
> caché por color **y** textura. Ver [materiales.md](materiales.md).

## `models/crowd/` — assets muertos

8 personajes de **Blocky Characters** de Kenney con sus texturas, y un
`CREDITS.md` que describe soldar seis cajas por personaje para dibujar «sesenta
y cinco personas en ocho llamadas».

> **Ningún código referencia `/models/crowd` ni `character-`.** `crowd.tsx`
> construye siluetas con primitivas porque los personajes de bloques se leían
> como cajas. Ver [cafe-y-multitud.md](cafe-y-multitud.md). Esta carpeta y su
> `CREDITS.md` describen un enfoque superado y hoy son 1,0 MB muerto.

## Las manos ya no son un modelo

Hubo aquí dos glTF de `@webxr-input-profiles/assets` (MIT), y se cargaban los
dos porque un esqueleto tiene quiralidad propia y había que elegir cuál ponerse.

**Se borraron.** La mano se construye ahora directamente sobre los landmarks,
así que no hay malla que cargar, ni par espejado entre el que elegir, ni 184 KB
que descargar. Ver [../logica/mano.md](../logica/mano.md).

## `cafes/` — las tres fotografías

`tinto.png` (133 KB) · `espresso.png` (207 KB) · `capuchino.png` (260 KB).

PNG con canal alfa: son recortes, tazas flotando sin fondo. Se usan sólo en la
portada (`app/page.tsx:82-94`).

Origen: fotografías con licencia Unsplash, recortadas con la máscara de primer
plano de Vision (la misma que usa Fotos para «copiar sujeto») y recortadas a sus
propios límites. Autores acreditados en el pie de la portada: Reinis Bruzitis,
Gabi Miranda y Alex Boyd.

Pesan 608 KB en el repositorio por el alfa, pero **`next/image` sirve WebP**: lo
que viaja al visitante son unos 40 KB en total.

## Licencias, resumen

| Qué | Licencia |
| --- | --- |
| Modelos de Kenney (kit, café, multitud) | CC0 1.0 |
| Fotografías de los cafés | Unsplash |
