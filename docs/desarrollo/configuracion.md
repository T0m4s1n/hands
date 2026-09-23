# Configuración

## `next.config.ts`

Una sola opción, y no es trivial:

```ts
reactStrictMode: false
```

El comentario que la acompaña es el registro de un fallo:

> El modo estricto monta cada componente dos veces en desarrollo para sacar a la
> luz efectos que no es seguro volver a ejecutar. Para componentes normales es un
> buen trato. **Para un lienzo WebGL no lo es**: montar dos veces construye un
> segundo renderer, con su propio mapa de sombras, su propio cubo de entorno y su
> propia copia de cada shader compilado, antes de que el primero haya soltado los
> suyos. En esta escena eso bastaba para **perder el contexto gráfico del todo**,
> así que el juego funcionaba en producción y mostraba un lienzo gris en
> desarrollo — **que es la peor combinación posible.**

Y la justificación de que sea seguro apagarlo: los efectos de la escena son
todos idempotentes (miden un modelo, lo ajustan y lo colocan), así que el doble
montaje no compraba nada aquí.

## `tsconfig.json`

Lo estándar de Next, más dos cosas que importan:

```jsonc
"allowImportingTsExtensions": true,
// Tests run straight through node's type stripping, which needs the
// explicit .ts on relative imports.

"paths": { "@/*": ["./*"] }
```

`strict: true`. `target: ES2017`. `moduleResolution: "bundler"`.

## `package.json`

```
test: node --experimental-strip-types --test hooks/*.test.ts components/coffee/*.test.ts
```

Sin framework de pruebas. Ver [../logica/pruebas.md](../logica/pruebas.md).

### Dependencias

| Paquete | Versión |
| --- | --- |
| `next` | 16.3.5 |
| `react` / `react-dom` | 19.2.8 |
| `three` | ^0.186.0 |
| `@react-three/fiber` | ^9.7.0 |
| `@react-three/drei` | ^10.7.8 |
| `@mediapipe/tasks-vision` | ^1.0.1 |
| `tailwindcss` | ^4 |

MediaPipe está en las dependencias, pero el módulo, el WASM y el modelo se
cargan **desde CDN en tiempo de ejecución**, con un import dinámico que el
bundler no puede reescribir. Ver
[../logica/seguimiento-de-manos.md](../logica/seguimiento-de-manos.md).

## `eslint.config.mjs`

`core-web-vitals` y `typescript` de `eslint-config-next`, con los ignorados por
defecto declarados explícitamente.

El **React Compiler** está activo y rechaza patrones que en React normal
pasarían. Ver [../convenciones.md](../convenciones.md).

## `postcss.config.mjs`

Un único plugin: `@tailwindcss/postcss`. Tailwind v4 no necesita más, y **no hay
`tailwind.config.js`**: el tema vive en `@theme` dentro de `app/globals.css`.

## `.claude/launch.json`

Configuración del servidor de desarrollo para el panel del editor: `npm run dev`
en el puerto 3000.

## `AGENTS.md` y `CLAUDE.md`

`CLAUDE.md` sólo contiene `@AGENTS.md`, o sea que importa el otro.

`AGENTS.md` tiene un bloque entre los marcadores
`<!-- BEGIN:nextjs-agent-rules -->` y `<!-- END:nextjs-agent-rules -->` que
**`next dev` reescribe**. Lo que se añada fuera de esos marcadores sobrevive;
lo que se meta dentro, no.
