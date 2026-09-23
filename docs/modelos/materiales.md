# Materiales

## El problema que resolvieron

`components/coffee/kit.tsx:187-197`:

> Los muebles de Kenney llevan un puñado de materiales con nombre por archivo, y
> veinte archivos de eso son **ochenta materiales físicos distintos** — cada uno
> un shader aparte, compilado contra cada luz de la sala y el mapa de entorno.
> Esa tormenta de compilación bastaba para **perder el contexto WebGL en el
> primer fotograma**. Nada a tres metros detrás de la barra necesita metalness
> ni un reflejo.

## El pool

`FLAT = new Map<string, MeshLambertMaterial>()` (`:198`).

Clave (`:216`): `` `${tint}/${source.map ? source.map.uuid : "none"}` ``.

**Por color *y* por textura.** Colapsar sólo por color (`:213-215`) "turned every
cake and cup on the back counter into a white blob", porque las piezas de comida
llevan todo su color en un atlas compartido.

`MeshLambertMaterial`, que sólo lleva `color` y `map`.

## El tono cálido

`:200-208`:

```
WARMTH   = new Color("#8f1824")
WARM_MIX = 0.42
```

> Los kits de mobiliario están dibujados en colores de exposición — blancos
> brillantes y grises fríos — y una sala construida con ellos tal cual parece
> una exposición. Tirar de cada color hacia el roble cálido, y quitarle algo de
> luz, es lo que convierte los mismos modelos en un café sin repintar un solo
> archivo.

Aplicado en `:220-221`: `lerp(WARMTH, WARM_MIX)` y luego `.multiplyScalar(0.92)`.

> El texto dice «a quarter of the way» pero la constante es **0.42**. Anotado
> tal cual.

## Los dos caminos de `tune()`

`:228-255`:

- **Decorado** (`!shadows`): todos los materiales se reemplazan por `flatten()` y
  se acabó.
- **Barra**: cada `MeshStandardMaterial` no visto aún (`TUNED`, un `WeakSet`, una
  sola vez por material cargado) se despierta:

```
metallic         = /metal|steel|chrome/i.test(material.name)
metalness        = metallic ? 0.75 : 0.06
roughness        = metallic ? 0.32 : 0.55
envMapIntensity  = metallic ? 1.35 : 0.85
```

**La detección de metal es por el nombre del material, nada más.**

El porqué (`:179-184`): los materiales del kit "are flat by design — no
metalness, roughness pinned at 1 — which reads as plastic under the scene's
lighting".

## Metal necesita algo que reflejar

Un `metalness` alto sin mapa de entorno refleja **sólo oscuridad**, y la pieza
sale casi negra. Por eso la escena lleva un `Environment` con Lightformers
(`HandTrackedScene.tsx:176-214`): "Metal and glaze need something to mirror
before they look like metal and glaze — with no environment at all the kit
models read as painted plastic".

Ver [escena.md](escena.md).

## Tone mapping

**El renderer no aplica tone mapping.** `toneMapping: NoToneMapping` en el
Canvas, porque la pasada de grado es su dueña. Ver
[post-proceso.md](post-proceso.md) — ahí está la explicación completa de por qué
hacerlo dos veces costaba el bloom entero.

## Materiales sin iluminar

Donde el sombreado PBR no aporta nada visible, se usa `meshBasicMaterial`:

- **Vapor** (`effects.tsx:97-102`): un soplo translúcido al 17 % en un
  `instancedMesh`. "Full PBR shading on it buys nothing anybody can see… The
  warmth the stage lamps used to put into it is baked into the colour instead."
- **Conos de luz** y **chispas lejanas** en `cafe.tsx`.
- **Wireframes de collider** en el laboratorio.

Y donde algo debe verse encendido pase lo que pase, `toneMapped={false}`: el
filamento de las lámparas, las bandas objetivo, el estallido de celebración.
