# Arquitectura

## Qué es

Un minijuego de barista para navegador. La cámara mira las manos, el jugador
pellizca para tomar los cacharros, y cada una de las cinco etapas de una receta
se puntúa por lo bien que se hizo. No se repite ninguna etapa: una mala sale
mal y se sigue adelante con peor nota.

Todo el reconocimiento corre dentro del navegador. No hay servidor al que
mandar la imagen.

## Rutas

| Ruta | Archivo | Qué hace |
| --- | --- | --- |
| `/` | `app/page.tsx` | Portada. **No renderiza nada en 3D**: tiene que ser legible al instante, antes de descargar un megabyte de modelos |
| `/jugar` | `app/jugar/page.tsx` | El juego (`HandTrackedApp`) |
| `/manos` | `app/manos/page.tsx` | Laboratorio de manos: sólo el seguimiento, con mandos para afinarlo |
| `/modelos` | `app/modelos/page.tsx` | Banco de pruebas de todas las piezas con sus colliders |

`/manos` es la única ruta sin `metadata` propio; hereda el título de la raíz.

## Las tres capas

```
         cámara
           │
     ┌─────▼──────────────────────────────┐
     │  hooks/useHandTracking.ts          │  reconocimiento
     │  hooks/handAssignment.ts           │
     └─────┬──────────────────────────────┘
           │  handsRef (ref, no estado)
     ┌─────▼──────────────────────────────┐
     │  components/CoffeeGame.tsx         │  juego
     │  components/coffee/*.ts            │  (lógica pura, sin React ni three)
     └─────┬──────────────────────────────┘
           │  onStatus (throttled)
     ┌─────▼──────────────────────────────┐
     │  components/HandTrackedApp.tsx     │  interfaz
     │  components/ui.tsx                 │
     └────────────────────────────────────┘
```

### El flujo de datos que importa

Las manos viajan por un **ref**, no por estado de React:
`useHandTracking` devuelve `handsRef` y el bucle de render lo lee en cada
fotograma sin provocar un solo re-render (`hooks/useHandTracking.ts:623-633`).
Sólo son estado `hud`, `status`, `error` y `thresholds`, y el HUD además se
publica como mucho cada 80 ms (`HUD_INTERVAL_MS`, `useHandTracking.ts:69`).

En sentido contrario, `CoffeeGame` avisa a la interfaz con `onStatus`, también
limitado: cada 80 ms o cuando algo cambia de verdad
(`PUBLISH_INTERVAL`, `components/CoffeeGame.tsx:103`).

Un juego a sesenta fotogramas que provoque un re-render por fotograma no llega
a sesenta fotogramas. Ésa es la razón de las dos barreras.

## Lógica pura, separada a propósito

Seis módulos en `components/coffee/` no importan ni React ni three:

`recipes.ts` · `gestures.ts` · `anim.ts` · `solid.ts` · `liquid.ts` · `slosh.ts`

Son números y funciones. Eso permite probarlos fuera del navegador con el
runner de Node, sin DOM ni WebGL — ver [logica/pruebas.md](logica/pruebas.md).
Cuando algo del juego se puede expresar como una función pura, va aquí.

## Orden de render de la escena

En `components/HandTrackedScene.tsx:216-266`:

1. `<Cafe />` — el local, la multitud, las pancartas
2. La barra (encimera, panel frontal, barra de latón, tapete)
3. `<CoffeeGame />` — la etapa en curso
4. `<HandGloves />` dentro de un `Suspense`
5. `<GradePass />` **el último, porque toma el control del bucle de render**

## Decisiones estructurales

- **El modo estricto de React está desactivado** (`next.config.ts`). No es
  pereza: el doble montaje construía un segundo renderer WebGL completo y eso
  bastaba para perder el contexto gráfico. Ver
  [desarrollo/configuracion.md](desarrollo/configuracion.md).
- **La altura de los objetos la decide el juego, no la mano.** Fue el cambio
  que arregló las colisiones. Ver
  [logica/solidos-y-colisiones.md](logica/solidos-y-colisiones.md).
- **Los modelos son de kits CC0 ajenos**, medidos y escalados al vuelo en vez
  de modelados aquí. Ver [modelos/kit-y-registro.md](modelos/kit-y-registro.md).
