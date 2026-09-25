# Tipografía

`app/globals.css:242-278`. "The type scale, named after what each size is for
rather than its pixels."

## La escala

| Clase | Tamaño | Interlínea | Peso | Tracking | Usos |
| --- | --- | --- | --- | --- | --- |
| `.t-large-title` | 2.125rem (34px) | 1.12 | 700 | −0.022em | 3 |
| `.t-title` | 1.5rem (24px) | 1.2 | 650 | −0.019em | 2 |
| `.t-headline` | 1.0625rem (17px) | 1.3 | 600 | −0.012em | 9 |
| `.t-body` | 1.0625rem (17px) | 1.45 | hereda | −0.011em | 5 |
| `.t-subhead` | 0.9375rem (15px) | 1.4 | hereda | −0.006em | 9 |
| `.t-footnote` | 0.8125rem (13px) | 1.35 | hereda | — | 25 |
| `.t-caption` | 0.75rem (12px) | 1.3 | hereda | — | 21 |

`t-headline` y `t-body` comparten tamaño y se separan por peso e interlínea: uno
titula, el otro se lee seguido.

El tracking negativo crece con el tamaño, que es lo correcto ópticamente: cuanto
más grande, más sobra el espacio entre letras.

## Titulares fuera de la escala

La portada y el permiso no usan la escala para sus titulares. Usan `clamp()`
directo, porque tienen que responder al ancho:

- `h1`: `text-[clamp(2.5rem,6.5vw,4.25rem)] font-black leading-[0.98] tracking-[-0.02em]`
- `h2` de sección: `text-[clamp(1.625rem,4vw,2.25rem)] font-black tracking-[-0.02em]`
- `h3` de tarjeta: `text-[1.5rem] font-black tracking-[-0.02em]`
- permiso y sync (`.gate-title`): `clamp(2.75rem, 12vw, 7.5rem)`, peso 700, tracking −0.045em

`font-black` (900) es el peso de la marca para gritar. La escala `t-*` no llega
tan arriba a propósito: es para interfaz, no para carteles.

## Números

Todo dato numérico lleva `tabular-nums`: puntuaciones, contadores de etapa,
medidas del laboratorio, lecturas del diagnóstico. Sin eso los dígitos bailan
al actualizarse.

Los valores técnicos van además en `font-mono`.

## Tracking en versalitas

Dos valores conviven:

- `0.14em` — la pastilla de la portada y el epígrafe de la hoja de resultado
- `0.12em` — el título del panel de diagnóstico

## La fuente

Poppins, cargada en `app/layout.tsx:5-9` con pesos 400, 500, 600 y 700.

> **Pero hoy no se usa.** `--font-sans` apunta a `--font-roboto`, que no existe.
> Ver [tokens-y-tema.md](tokens-y-tema.md). El `font-black` (900) que piden los
> titulares tampoco está entre los pesos cargados.
