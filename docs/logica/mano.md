# La mano

`components/RobotHand.tsx` (~440 líneas).

## Qué la sustituyó, y por qué

Antes aquí se posaba una mano glTF con esqueleto: se leía la pose de reposo de
las matrices inversas de bind, se recorría cada dedo como una cadena, se
resolvía una rotación por hueso y se mantenía cada articulación dentro de
límites. Mil líneas.

Todo aquello servía a **un solo requisito**: una malla con esqueleto tiene
longitudes de hueso fijas y hay que respetarlas. Y ese requisito era la causa de
toda la fragilidad:

| Consecuencia del requisito | Cómo fallaba |
| --- | --- |
| Si las longitudes son fijas, la profundidad **hay que inventarla** — un hueso acortado en pantalla se fue a alguna parte | Inventarla necesita un signo, y el signo es indecidible justo donde más importa |
| Un esqueleto tiene **quiralidad propia**, así que hay que elegir cuál de dos modelos espejados ponerse, y volver a elegir cada vez que la mano gira | Elegir mal **reconstruye el rig a mitad de gesto** |
| Resolver rotaciones **en cadena** acumula error | Un ángulo malo en un nudillo mueve todo lo que hay más allá; uno malo en la muñeca mueve la mano entera |

Los tres fallos de inestabilidad que se arreglaron uno a uno eran el mismo
fallo asomando por sitios distintos.

## Cómo funciona ahora

**No hay esqueleto, así que no hay nada que reorientar.**

- Cada **segmento** se dibuja entre los dos landmarks que abarca.
- Cada **articulación** se dibuja donde está su landmark.

Eso es todo el posado. Ninguna rotación se resuelve; sólo se lee.

```
dir    = current[b] - current[a]
length = |dir|
mid    = (current[a] + current[b]) / 2
quat   = setFromUnitVectors(AXIS_Y, dir / length)
matrix = compose(mid, quat, (grosor, length, grosor))
```

Consecuencias directas:

- Una mano izquierda sale izquierda **porque sus puntos son los de una mano
  izquierda**. No hay quiralidad que detectar ni modelo que elegir.
- Un dedo que no se lee bien sale mal **él solo**, sin arrastrar a la mano.
- No hacen falta límites articulares: los landmarks ya describen una mano real.
- No hace falta reconstruir profundidad: la dirección del hueso **es** la
  diferencia entre landmarks.

La prueba de que el enfoque funciona llevaba todo el tiempo en pantalla:
`LandmarkDots` dibuja así desde el principio y nunca se retorció.

## Profundidad, y por qué hay que estirarla

MediaPipe reporta la profundidad a **aproximadamente un quinto** de la escala de
los otros dos ejes. `WORLD_Z` en el tracker deshace parte de eso, pero se eligió
cuando la profundidad sólo decidía la forma de un dedo, y es deliberadamente
tímido.

Lo que deja es una mano lo bastante plana como para que **ningún dedo pase nunca
por detrás de otro**. Y una mano cuyas partes no se tapan entre sí no se lee
como un objeto sólido, por bien sombreada que esté: se lee como una pegatina.

Por eso `deepen()` estira la profundidad **sobre la muñeca**, para que la mano se
ahonde donde está en vez de deslizarse hacia la cámara al cambiar la escala. El
mando **«Profundidad de la mano»** (`depthScale`, 2.2 por defecto) lo gobierna, y
está por encima de 1 a propósito.

La oclusión en sí no hace falta programarla: los materiales hacen depth test,
así que en cuanto hay separación real en el eje de visión, lo de detrás queda
tapado.

## Lo que cuesta

**Los dedos cambian de longitud aparente al girar hacia la cámara**, porque nada
les obliga a conservarla. Es exactamente el hecho contra el que peleaban las
cuatrocientas líneas de IK, y aceptarlo es lo que compra todo lo de arriba.

## El aspecto

No puede parecer carne, así que no lo intenta: una mano de dibujos, con
falanges gruesas y rótulas gordas.

**Sombreado cel.** Todo usa `meshToonMaterial` contra una rampa de **cuatro
escalones planos** en vez de un degradado suave. Es lo que lo convierte en un
dibujo en vez de un render. El precio: el sombreado toon no tiene metalness ni
reflejos, así que el latón deja de ser metal literal y pasa a ser *el color con
el que se dibuja el oro* — que para una caricatura es el cambio correcto.

Los colores van **pitados de brillo** a propósito (`#fbf0d9`, `#f2ab2c`): la
rampa escalona todo hacia el extremo oscuro, así que un color elegido para verse
bien plano sale embarrado una vez sobre ella.

| Pieza | Forma |
| --- | --- |
| Falanges | Cilindro apenas cónico, gordo |
| Articulaciones | Esferas grandes, que además rematan los cilindros |
| Placa de palma | `RoundedBox` medida de la mano que tiene delante |
| Puño | Un tono por mano: `Left #d98c3c`, `Right #7a3b1e` |

Una cápsula sería la forma obvia para un hueso **y es la equivocada**: escalarla
a la longitud del hueso estira sus tapas en huevos. Un cilindro se escala
limpio, y las esferas de las articulaciones sobresalen por los dos extremos, lo
que lo redondea gratis.

Los grosores están escritos a mano por landmark (`JOINT_SIZE`) y no derivados,
porque una mano no es uniforme: los nudillos son más anchos que los huesos que
los flanquean, y eso es lo que hace que una mano articulada se lea como
articulada.

El color dice dos cosas a la vez: si la mano está siendo vista (presencia) y si
está agarrando algo (las rótulas viran al ámbar).

## Dibujo

Dos `instancedMesh` por mano — 21 segmentos y 21 articulaciones — más la placa
y el puño. La geometría de segmento es un cilindro cónico, y **el cono tiene
sentido**: las conexiones van de padre a hijo, así que el extremo estrecho cae
siempre del lado de la yema.

## Lo que se conservó

- **El suavizado** (`stillRate 16 → movingRate 90`, `depthDamping 0.75`). Sigue
  haciendo falta: el temblor no se fue con el rig.
- **`lockSpan`** ([palmFrame.ts](../../hooks/palmFrame.ts)). El tamaño aparente
  crece y mengua con la distancia a la cámara, y seguirlo hacía latir la mano.
- **`REST_POSE`**, para el sustituto de ratón. Pasa por el mismo `lockSpan` que
  una mano seguida, así que las dos miden igual por construcción.
- **`deepen`** y **`palmFrame`**, este último con un papel mucho menor: orienta la placa y el puño.
  Si el ruido de profundidad lo agita, se agitan **una placa y un puño**. Antes
  orientaba la mano entera.

## Lo que murió con el rig

`CHAINS`, `Limits`, `HINGE`/`KNUCKLE`/`TIP_JOINT`, `BoneRig`, `buildRig`,
`readBindPose`, `findSkinnedMesh`, `handednessVolume`, `modelChirality`,
`trackedDirection`, `constrainDirection`, `MAX_BONE_SLEW`, el intercambio de
modelo entero con su `layoutSign`/`layoutSkew`/`layoutSpread`, y
`hooks/boneAim.ts`.

También `public/models/hand-left.glb` y `hand-right.glb`, 184 KB que ya no
referencia nadie.
