# Café a mano

Un minijuego de barista que se juega **con las manos delante de la cámara**.
Tres cafés, cinco etapas cada uno, y una nota al final.

Sin mando y sin teclado: la cámara mira tus manos, pellizcas para tomar los
cacharros, y cada etapa se puntúa por lo bien que la hagas. **No se repite
nada** — si sale mal, sigues con peor nota.

Todo el reconocimiento corre dentro del navegador, sobre el modelo de manos de
MediaPipe. La imagen no sale de tu equipo: no se sube, no se guarda y no hay
servidor al que mandarla.

## Arrancar

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

Si no quieres dar la cámara, «Continuar con el ratón»: mantener pulsado para
pellizcar, mover para mover, y la rueda para girar la muñeca e inclinar.

## Las rutas

| Ruta | Qué es |
| --- | --- |
| `/` | Portada. No renderiza 3D, para que se lea al instante |
| `/jugar` | El juego |
| `/manos` | Laboratorio: sólo el seguimiento, con mandos en vivo |
| `/modelos` | Banco de pruebas: cada pieza con su collider y sus medidas |

## Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación |
| `npm run lint` | ESLint |
| `npm test` | Tests de lógica pura, sin navegador |

## Requisitos

- Node.js 22 o superior
- Una cámara web, o el sustituto con ratón
- Un navegador con WebGL2. Chromium acelera la inferencia por GPU; el resto cae
  al delegado de CPU automáticamente

## Documentación

La descripción completa de cómo funciona está en **[`docs/`](docs/)**, repartida
en archivos específicos:

| Área | Índice |
| --- | --- |
| Visión de conjunto | [docs/arquitectura.md](docs/arquitectura.md) |
| Reglas que valen en todo el proyecto | [docs/convenciones.md](docs/convenciones.md) |
| Reconocimiento y juego | [docs/logica/](docs/logica/) |
| Modelos, escena y render | [docs/modelos/](docs/modelos/) |
| Diseño e interfaz | [docs/estilos/](docs/estilos/) |
| Herramientas y configuración | [docs/desarrollo/](docs/desarrollo/) |

Empieza por [docs/README.md](docs/README.md), que es el índice.

> **Antes de tocar nada**, lee [docs/convenciones.md](docs/convenciones.md). El
> mundo es **Z-up** — `z` es la altura sobre la barra — y eso contradice lo que
> hace three por defecto.

## Registro de cambios

**Todo cambio se anota en [`CHANGELOG.md`](CHANGELOG.md).**

No es burocracia: este proyecto tiene decisiones que sólo se entienden sabiendo
qué se rompió antes. Una entrada que dice *qué* cambió y *por qué* vale más que
el diff.

Si tocas el código y no lo anotas, el cambio no está hecho.

## Créditos

| Qué | Origen | Licencia |
| --- | --- | --- |
| Modelos de objetos, mobiliario y personajes | [Kenney](https://kenney.nl) | CC0 1.0 |
| Manos articuladas | `@webxr-input-profiles/assets` | MIT |
| Fotografías de los cafés | Unsplash — Reinis Bruzitis, Gabi Miranda, Alex Boyd | Unsplash |
| Reconocimiento de manos | MediaPipe Hand Landmarker | Apache 2.0 |

Paleta y estilo visual inspirados en [La Mejor Taza](https://narino.gov.co/lamejortaza/),
Nariño.

## Stack

Next.js (App Router) · TypeScript · Tailwind CSS v4 · three.js ·
@react-three/fiber · @react-three/drei · @mediapipe/tasks-vision
