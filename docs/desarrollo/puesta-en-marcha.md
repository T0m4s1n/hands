# Puesta en marcha

## Requisitos

- **Node.js 22 o superior.** Los tests usan `--experimental-strip-types`, que
  necesita una versión reciente.
- Una **cámara web**, o nada: hay un sustituto con ratón.
- Un navegador con **WebGL2**. Chromium da inferencia acelerada por GPU; los
  demás caen al delegado de CPU automáticamente.

## Instalar y arrancar

```bash
npm install
npm run dev
```

Abre <http://localhost:3000>.

## Los scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Compilación de producción |
| `npm run start` | Sirve la compilación |
| `npm run lint` | ESLint |
| `npm test` | Los tests de lógica pura |

## La comprobación completa

Antes de dar por bueno un cambio:

```bash
npx tsc --noEmit
npx eslint app components hooks
npm test
npm run build
```

`npm run build` tiene que terminar con las cinco rutas: `/`, `/_not-found`,
`/jugar`, `/manos`, `/modelos`.

## Sin cámara

En la pantalla de permiso, «Continuar con el ratón»:

- **Mantener pulsado** el botón izquierdo = pellizcar.
- **Mover** el ratón = mover la mano.
- **Rueda** = girar la muñeca, que es lo que inclina y vierte.

Sin la rueda dos de las tres recetas serían imposibles de terminar sin cámara.

La rueda **ya no sube ni baja la mano**: esa altura la decide el juego. Ver
[../logica/solidos-y-colisiones.md](../logica/solidos-y-colisiones.md).

## Las rutas de trabajo

Dos rutas existen para depurar, y ahorran mucho tiempo:

- **`/manos`** — sólo el seguimiento, sin juego, con mandos en vivo para el
  suavizado, la amortiguación de profundidad y la zona muerta de los dedos.
- **`/modelos`** — las 13 piezas en plataformas giratorias con sus colliders
  dibujados encima y sus medidas en pantalla.

## Al tocar el código

1. Lee [../convenciones.md](../convenciones.md) primero. El mundo es **Z-up** y
   eso rompe la intuición de three.
2. Si el comportamiento se puede escribir como función pura, ponlo en
   `components/coffee/` y pruébalo.
3. **Anota el cambio en [`../../CHANGELOG.md`](../../CHANGELOG.md).**

## Fallos conocidos al desarrollar

- **Trozos rancios.** El servidor de desarrollo a veces sirve código que ya no
  existe y produce errores fantasma que citan líneas borradas. Si `npm run build`
  sale limpio y el error habla de algo que no está en el archivo, es esto: borra
  `.next` y vuelve a arrancar.
- **Imágenes cacheadas.** Cambiar un archivo de `public/` conservando el nombre
  no basta: `next/image` cachea por URL. Renombrar el archivo lo resuelve de
  raíz.
