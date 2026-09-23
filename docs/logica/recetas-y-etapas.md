# Recetas y etapas

`components/coffee/recipes.ts` (353 líneas). Qué se prepara y cómo se puntúa.

## La idea de fondo

El comentario de cabecera (`:1-8`):

> Una etapa nunca se falla hasta repetirla — siempre termina y siempre deja una
> nota entre 0 y 1. Ésa es toda la idea de puntuación: un vertido torpe vierte
> igual, sólo que hace peor café.

## Tipos

`StageKind` = `place` · `crank` · `hold` · `tamp` · `shake` · `tilt`
(`:13-25`, cada uno con su gesto y sobre qué se puntúa).

`Stage` (`:43-75`):

| Campo | Qué es |
| --- | --- |
| `id`, `title`, `instruction` | Identidad y el texto que se muestra |
| `kind` | El gesto que pide |
| `item` | Dónde empieza el objeto, en coordenadas de mesa |
| `target` | Dónde tiene que ir, o el pivote de un giro |
| `radius` | Cuánto de cerca cuenta como dentro |
| `goal` | La cantidad a la que apuntar, **en la unidad del gesto** |
| `band` | El intervalo que da nota máxima. Misma unidad que `goal` |
| `rate` | Velocidad de llenado para `hold` y `tilt` |
| `holds`, `sits` | Qué se toma y sobre qué se deja |
| `vessel`, `liquid` | Qué se llena y con qué |

`goal` y `band` **comparten unidad** siempre: radianes para un giro, número de
prensados, número de agitados, o nivel 0..1 para llenar y verter.

## Puntuación

```
bandScore(value, [low, high])                              // :331-340
  = 1                                    dentro de [low, high]
  = max(0, 1 - miss / max((high-low)*0.9, 1e-4))   fuera

placeScore(distance, radius) = max(0, 1 - distance / max(radius, 1e-4))

grade(s) = ≥0.9 "Excelente" | ≥0.75 "Muy bueno" | ≥0.6 "Correcto"
         | ≥0.4 "Mejorable" | resto "Para tirar"
```

El ancho del desvanecido es el ancho de la propia banda × 0,9: una ventana
aceptable más ancha perdona también más fuera de ella.

## Puntos de anclaje

`:86-89`: `GRINDER = [1.85, 0.1]`, `STATION = [0, 0.1]`,
`RIGHT_REST = [1.9, 0.1]`, `LEFT_REST = [-2.15, -0.2]`.

## Las tres recetas

### Tinto — la suave
`#4a2a16`. "Filtrado, suave. Buen sitio para empezar."

| # | Etapa | Gesto | Objetivo | Banda |
| --- | --- | --- | --- | --- |
| 1 | Dosifica | `place` cuchara → molino | — | r 1.02 |
| 2 | Muele | `crank` | 4π | [3π, 5π] |
| 3 | Filtro | `place` filtro → cafetera | — | — |
| 4 | Vierte | `tilt` tetera → cafetera | 0.8 | [0.7, 0.9], rate 0.45 |
| 5 | Sirve | `place` taza → plato | — | — |

### Espresso — la precisa
`#2d1608`. "Corto e intenso. Pide pulso en el prensado."

| # | Etapa | Gesto | Objetivo | Banda |
| --- | --- | --- | --- | --- |
| 1 | Dosifica | `place` cuchara → portafiltro | — | — |
| 2 | Muele fino | `crank` | 6π | [5π, 7π] |
| 3 | Prensa | `tamp` | 3 | [2, 4] |
| 4 | Extrae | `hold` portafiltro → máquina | 0.68 | [0.55, 0.8], rate 0.38 |
| 5 | Sirve | `place` | — | — |

### Capuchino — la movida
`#6b4326`. "Con leche espumada. El más movido de los tres."

| # | Etapa | Gesto | Objetivo | Banda |
| --- | --- | --- | --- | --- |
| 1 | Muele | `crank` | 5π | [4π, 6π] |
| 2 | Extrae | `hold` | 0.58 | [0.45, 0.7], rate 0.42 |
| 3 | Espuma | `shake` jarra | 10 | [8, 14] |
| 4 | Vierte la leche | `tilt` jarra → taza | 0.6 | [0.5, 0.75], rate 0.5 |
| 5 | Sirve | `place` | — | — |

La etapa de espuma tiene `target = item`, así que se agita en el sitio.

## El contrato que se prueba

`gestures.test.ts` caso 11 es estructural sobre **todas** las recetas:

- Exactamente 3 recetas con `id` únicos.
- Exactamente 5 etapas cada una.
- Toda etapa tiene `radius > 0` e `instruction` no vacía.
- Toda etapa que no sea `place` tiene banda con `low < high` **que contiene su
  propio `goal`** — o sea, se puede sacar nota máxima haciendo lo que pide.
- Toda etapa `hold` o `tilt` tiene `rate > 0` y `high <= 1` — o sea, **no puede
  pedir que rebose**.
