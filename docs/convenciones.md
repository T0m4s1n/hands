# Convenciones

Las reglas que no se ven en un archivo suelto pero que valen en todo el
proyecto. Romper cualquiera de éstas produce errores que cuestan horas.

## El mundo es Z-up

**`z` es la altura sobre la barra. `x` e `y` son el plano de la mesa.**

No es lo que hace three por defecto, y no hay ningún `camera.up` que lo
imponga: sale de dónde está puesta la cámara
(`components/HandTrackedScene.tsx:21-22`). La mesa es el plano XY y la cámara
mira hacia abajo, "so depth never has to be judged by the player".

Consecuencias prácticas:

- Los kits vienen dibujados **Y-up**, así que cada modelo entra con
  `rotation.set(Math.PI / 2, 0, 0)` (`components/coffee/kit.tsx:284`).
- Las cápsulas, cilindros y conos de three crecen a lo largo de **Y**, así que
  cualquiera de ellos necesita girarse (`components/coffee/crowd.tsx:119`).
  Las lámparas colgantes quedaron tumbadas hasta que se corrigió esto.
- Los planos se escriben con `rotation={[Math.PI/2, 0, 0]}`.
- Lo que dé por supuesto Y-up no sirve. `ContactShadows` de drei se quitó por
  eso.

Alturas de referencia: `FLOOR_Z = -3.1` (`cafe.tsx:22`),
`TABLE_Z = -0.34` (`HandTrackedScene.tsx:17`), `REST_Z = 0.12`
(`CoffeeGame.tsx:84`), `HAND_HOVER = 0.95` (`useHandTracking.ts`).

## Unidades

- **Distancias**: unidades de mundo. El ancho del cuadro de cámara son 7
  (`WORLD_X`, `useHandTracking.ts:73`).
- **Masa**: no son kilos, es una proporción (`solid.ts:34-37`). Sólo importa
  la relación entre piezas: la máquina pesa 14, una cuchara 0,6.
- **Ángulos**: radianes siempre.
- **Notas**: de 0 a 1 en todo el sistema de puntuación.
- **Landmarks de MediaPipe**: normalizados 0..1 sobre el ancho y el alto **por
  separado**, así que los dos ejes sólo miden lo mismo después de dividir la
  forma del cuadro. Eso lo hace `worldY` (`useHandTracking.ts:74-79`).

## Límites del React Compiler

El compilador está activo y rechaza cosas que en React normal pasarían:

- **No mutar un valor de `useMemo`.** Construir un objeto con `useMemo` y
  escribir en él después es un error de lint.
- **No asignar dentro de `useFrame` un ref del que dependa un efecto.** Por eso
  `GradePass` construye su rig en un efecto de montaje y no en el bucle
  (`components/coffee/grade.tsx:249-252`).
- Acumuladores que el bucle necesite escribir van en un `useRef`, no en un
  `useMemo`.

## Ciclos de importación

`ModelLab` y `ModelLabScene` necesitaban los dos la lista de piezas, y que uno
importara al otro creaba un ciclo que **en desarrollo se resolvía a
`undefined`** y dejaba el banco de pruebas vacío. Por eso `PIECES` vive en
`kit.tsx` (`components/coffee/kit.tsx:333-343`), que no importa a ninguno de los
dos.

## Comentarios

Los comentarios del código están **en inglés** y explican el *porqué*, no el
qué. Un comentario que repite lo que dice la línea siguiente sobra; uno que
cuenta qué se rompió antes vale más que este documento entero.

Esta documentación está en español. Los nombres de API, tipos, constantes,
rutas y mensajes de error se citan literales, sin traducir.

## Mensajes de commit

En inglés, como los que ya hay. Sin líneas de atribución.
