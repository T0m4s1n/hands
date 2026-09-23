# La portada

`app/page.tsx` (436 líneas). Ruta `/`.

## Para qué existe

`:20-51`, el comentario más rico del repositorio:

> Un juego que necesita cámara **tiene que ganarse el aviso de permiso antes de
> pedirlo**, así que esta página dice qué es la cosa, qué va a hacer con la
> cámara y qué quiere de tus manos — y sólo entonces ofrece la entrada.

Y la restricción técnica que manda sobre todo lo demás:

> **No renderiza nada en 3D: tiene que ser legible al instante, antes de que se
> descargue un megabyte de modelos.**

## Estructura

Cuatro `Field` en orden (ver [campos-y-secciones.md](campos-y-secciones.md)):

| # | Tono | Curva | Contenido |
| --- | --- | --- | --- |
| 1 | `wine` | — | Cabecera, titular, llamada a la acción |
| 2 | `roast` | `pour` | Las tres recetas |
| 3 | `forest` | `roll` | Los cuatro gestos y el aviso de cámara |
| 4 | `deep` | `hill` | Créditos y navegación |

La columna de contenido es siempre
`relative mx-auto w-full max-w-3xl px-6 sm:px-8`.

## El héroe

- Resplandor: `radial-gradient(58% 48% at 50% 4%, rgba(190,44,58,0.85), transparent 72%)`
  — "The lit pool the brand puts behind its logo, **breathing so the field is
  never quite the same twice.**"
- Dos ramas con `sway` a 13 s y 17 s, ancladas en `origin-top-left` /
  `origin-top-right` — "**Hinged near the stem, so they lean the way a branch
  does rather than sliding about like a sticker.**"
- Filete dorado bajo la cabecera: "The thin gold rule the brand runs under its
  masthead."
- Pastilla ámbar: «MINIJUEGO DE BARISTA».
- Titular en `font-black`, `leading-[0.98]`.
- Llamada a la acción: un `Link`, **no el componente `Button`**, con
  `min-h-[3.25rem]` y una flecha que se desplaza al pasar el ratón.
- Escape: «Se puede jugar con ratón si no quieres dar la cámara.»

## Las tarjetas de receta

Datos de `components/coffee/recipes.ts` más la tabla `PHOTO` (`:60-97`).

### Por qué fotografías y no dibujos

`:60-77`:

> Las tazas dibujadas fueron el instinto equivocado — «una ilustración dice "una
> web sobre café", una fotografía dice "café"» — pero una fotografía dentro de un
> rectángulo sigue siendo una imagen clavada en la tarjeta. **Recorta la taza y
> deja de ser la imagen de una cosa para ser la cosa, posada en la página.**

Los recortes se sacaron con la máscara de primer plano de Vision, «la misma que
hay detrás de "copiar sujeto" en Fotos», y se recortaron a sus propios límites
"so that one CSS height means the same size for all three". PNG por el alfa;
`next/image` sirve WebP a quien lo acepte.

Sobre `lift`:

> Un plato ancho y una taza alta **no se ven del mismo tamaño aunque ocupen la
> misma caja** — igualar geometría no es igualar cuánto de grande parece algo, y
> eso sólo lo resuelve el ojo.

| Receta | Archivo | `lift` |
| --- | --- | --- |
| `tinto` | `/cafes/tinto.png` | 1 |
| `espresso` | `/cafes/espresso.png` | 1.1 |
| `capuchino` | `/cafes/capuchino.png` | 1.04 |

### La composición

Los lados **se alternan** fila a fila (`row % 2 === 1 ? "sm:flex-row-reverse"`),
"so three of these in a column read as a list rather than as one card printed
three times".

El panel de la foto lleva el `colour` de la receta como fondo y un charco de luz
radial detrás de la taza:

> "The cup floats on the panel rather than filling it. What sells that is the
> light behind it and the shadow under it: **with neither, a cutout reads as a
> sticker.**"

Y sobre el dimensionado (`:259-261`): "Padded box first, then the image contained
inside it, **so no cup can ever reach an edge.** The scale on top is optical
only."

El lado de texto lleva las cinco etapas numeradas, cada número en una ficha que
vira al ámbar al pasar el ratón sobre la tarjeta.

## Los gestos

Cuatro fichas en rejilla, de la tabla `GESTURES` (`:53-58`):

| Nombre | Texto |
| --- | --- |
| Pellizca | Junta pulgar e índice para tomar un objeto. |
| Abre | Separa los dedos y lo sueltas donde esté. |
| Mueve | La mano lleva el objeto; la altura la pone el juego. |
| Gira | Rota la muñeca para inclinar y verter. |

Debajo, la tarjeta «Sobre tu cámara», que termina con una comprobación que el
lector puede hacer: «Puedes comprobarlo desconectando la red una vez cargado el
juego.»

El colibrí vive aquí, en el verde. Ver [botanica.md](botanica.md).

## El pie

Créditos: modelos de Kenney CC0, manos WebXR MIT, fotografías de Unsplash con
los tres autores enlazados. Navegación a `/jugar`, `/manos` y `/modelos`.

## La regla de las decoraciones

`:44-51`:

> Cada dibujo está recortado a su sección y clavado al margen exterior, y se
> elimina del todo por debajo del ancho donde ese margen existe. **Que las hojas
> caigan sobre las palabras es la única manera en que este diseño falla, y el
> único arreglo fiable es una caja de la que no puedan salir.**

Por eso todo lo botánico lleva `hidden lg:block` o `hidden xl:block`.
