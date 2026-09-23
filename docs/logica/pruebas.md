# Pruebas

## Cómo se ejecutan

```bash
npm test
```

Que es:

```
node --experimental-strip-types --test hooks/*.test.ts components/coffee/*.test.ts
```

Sin framework, sin transpilación previa, sin DOM y sin WebGL. Node quita los
tipos y ejecuta. Por eso `tsconfig.json` lleva `allowImportingTsExtensions: true`
y los imports relativos de los tests escriben el `.ts` explícito.

## Qué se puede probar así

Sólo los módulos que no importan React ni three. Ésa es la razón de que la
lógica viva separada en `components/coffee/`: una regla de puntuación, una
curva de vertido o una separación de colisión son aritmética, y la aritmética se
comprueba sin navegador.

Lo que **no** está cubierto: el bucle de render, el rig del guante, la carga de
modelos, el post-proceso y toda la interfaz. Eso se verifica a mano en el
navegador y en `/manos` y `/modelos`.

## Los ocho archivos

| Archivo | Cubre |
| --- | --- |
| `hooks/handAssignment.test.ts` | Emparejamiento de manos entre fotogramas |
| `components/coffee/anim.test.ts` | Muelles, `approach`, `ease`, `pulse` |
| `components/coffee/gestures.test.ts` | Detectores y el contrato de las recetas |
| `components/coffee/physical.test.ts` | Volumen de líquido y sólidos |
| `components/coffee/slosh.test.ts` | La onda de la superficie |
| `components/coffee/solid.test.ts` | La altura de transporte |
| `hooks/palmFrame.test.ts` | Hacia dónde mira la mano |
| `hooks/boneAim.test.ts` | Hacia dónde apunta cada hueso |

Cuatro de los ocho son bloques de aserciones a nivel superior; `solid.test.ts`,
`palmFrame.test.ts` y `boneAim.test.ts` usan `test()` de `node:test`.

## Las pruebas que valen más

Cinco, y las cinco nacieron de un fallo real:

1. **`anim.test.ts`** — un solo fotograma de un segundo deja el muelle finito.
   Una pestaña que vuelve de segundo plano entrega justo eso.
2. **`slosh.test.ts`** — 400 iteraciones con fotogramas de 1,5 s y parámetros
   fuera de rango dejan todas las celdas finitas. Un `NaN` ahí se extiende a
   cada vértice de la malla.
3. **`solid.test.ts`** — a la altura que `carryOver` decide, `overlap` devuelve
   `null`. Es el cierre del círculo del fallo de colisiones.
4. **`palmFrame.test.ts`** — con el comportamiento viejo, una mano cabeceada y
   una mano girada dan una marca **idéntica** a la de una mano plana. No
   atenuada: idéntica, a cero grados. Las dos primeras pruebas dejan ese fallo
   escrito para que no pueda volver sin que algo falle.
5. **`boneAim.test.ts`** — dos huesos inclinados en sentidos opuestos de
   profundidad tienen que apuntar en sentidos opuestos. Antes recibían el mismo
   signo, calculado una vez para toda la mano, y por eso una mano en ángulo se
   aplastaba con todos los dedos juntos.

Una nota sobre escribirlas: al redactar `boneAim.test.ts` la primera versión
falló, y **era la prueba la que estaba mal**, no el código. Esperaba que la
profundidad conservara su magnitud, y el diseño sólo conserva el signo a
propósito. Merece decirse: una prueba que falla no siempre acusa al código.

Además `gestures.test.ts` caso 11 es un contrato estructural sobre las recetas:
si alguien añade una etapa cuya banda no contiene su propio objetivo, o una
etapa de llenado que pide rebosar, la prueba falla. Ver
[recetas-y-etapas.md](recetas-y-etapas.md).

## Al añadir una prueba

Si el comportamiento se puede expresar como una función pura, muévelo a
`components/coffee/` y pruébalo. Si no, no fuerces: verifícalo en el navegador y
anótalo.
