# Modelos de la barra de café

Ninguno de estos modelos fue hecho aquí. Todos vienen de kits publicados bajo
**CC0 1.0 (dominio público)**, lo que permite usarlos en cualquier proyecto,
comercial incluido, sin pedir permiso y sin obligación de dar crédito. Se da
igualmente, porque corresponde.

**Autor:** Kenney — <https://kenney.nl>
**Licencia:** [Creative Commons Zero 1.0](http://creativecommons.org/publicdomain/zero/1.0/)

## Food Kit 2.0

<https://kenney.nl/assets/food-kit>

| Archivo | Papel en el juego |
| --- | --- |
| `cup-coffee.glb` | la taza |
| `cup-saucer.glb` | el plato |
| `mortar.glb` | el mortero donde se muele |
| `mortar-pestle.glb` | la mano de mortero que se gira |
| `cooking-spoon.glb` | la cuchara de dosificar |
| `pot.glb` | la tetera |
| `carton.glb` | la jarra de leche |
| `bowl.glb` | el filtro |
| `frying-pan.glb` | el portafiltro |
| `meat-tenderizer.glb` | el prensador |
| `whipped-cream.glb` | la espuma del capuchino |

Los once comparten `Textures/colormap.png`, que el glTF referencia por ruta
relativa: si se mueven de carpeta, hay que mover la textura con ellos.

## Furniture Kit

<https://kenney.nl/assets/furniture-kit>

| Archivo | Papel en el juego |
| --- | --- |
| `kitchen-coffee-machine.glb` | la máquina de espresso |

Este no usa textura; sus colores van en el propio material.

## Lo que sí es código

El café líquido, la espuma que sube, el vapor, los granos y las chispas de
acierto no son modelos: cambian de forma cada fotograma según lo que hace el
jugador, así que se generan en `components/coffee/`. Un archivo `.glb` no puede
llenarse a la mitad.
