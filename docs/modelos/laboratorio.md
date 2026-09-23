# El laboratorio de modelos

Ruta `/modelos`. Dos archivos: `components/ModelLab.tsx` (la mitad DOM) y
`components/ModelLabScene.tsx` (la mitad 3D).

## Para qué existe

`ModelLab.tsx:14-23`:

> Para cazar las cosas que sólo aparecen una vez el modelo está en la escena y
> que son **miserables de encontrar desde dentro de un juego de cinco etapas**:
> una pieza que carga pero mide mal, una cuya textura no viajó con ella, una
> mirando al revés, una cuyo collider no se parece en nada a su forma.

## Qué muestra

Las 13 piezas de `PIECES` sobre plataformas giratorias, **al tamaño exacto que
usa el juego**, con su collider dibujado encima en wireframe.

Cada pieza se renderiza con `<KitModel {...piece.entry} />`, o sea que el
laboratorio ejercita **exactamente el mismo camino de medición y ajuste** que el
juego. Si algo se rompe aquí, está roto allí.

## Mandos

- **Mostrar colliders** (por defecto sí)
- **Girar** (por defecto sí)
- Lista de piezas: pulsar una la **aísla** y acerca la cámara

## La ficha

`Detail` (`ModelLab.tsx:125-165`) lee `KIT[kind]` directamente e imprime:

`archivo` · `carpeta` · `tamaño` · `giro` · `masa` · `fricción` · `forma` ·
`medidas` · `recipiente` · `oculta`

Las medidas se formatean según la forma: una `slab` como `largo × ancho × alto`,
las demás como `r … · h …`.

## Cómo se dibujan los colliders

`Collider` (`ModelLabScene.tsx:21-59`), en `#57e0b0`:

| Forma | Dibujo |
| --- | --- |
| `slab` | Caja de `halfLong*2 × halfShort*2 × height` |
| `round` | Cilindro `openEnded` |
| `open` | Cilindro `openEnded` **más un disco `#ffb03a`** en `z = floor` con radio `rim` |

El disco naranja es "the inner rim and the floor things land on" — la diferencia
entre posarse en el borde y caer dentro.

## La escena

Luz neutra a propósito, nada de la ambientación del café: hemisférica, ambiental
0.4 y una direccional con sombras. Fondo `#14161b`. Un suelo "so nothing floats
without it being obvious".

**No lleva `GradePass`**, así que tampoco lleva la corrección de `toneMapping`:
aquí el renderer hace el suyo, que es lo correcto.

## Las etiquetas

`<Html>` de drei con `pointerEvents: none` (`:142-153`), y no texto 3D, porque
eso "would mean fetching a font before the lab could show anything".
