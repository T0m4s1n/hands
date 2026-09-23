# Registro de cambios

Todo cambio en el proyecto se anota aquí. Si tocas el código y no lo anotas, el
cambio no está hecho.

Formato: lo más reciente arriba. Cada entrada dice **qué** cambió y, cuando la
razón no es obvia, **por qué**. Un «arreglado» sin el fallo que arreglaba no
sirve de nada dentro de seis meses.

---

## Sin publicar

### Las manos responden y giran

- **Quitado el suavizado doble.** El guante volvía a filtrar en espacio de mundo
  lo que el tracker ya había filtrado, y a menos de la mitad de velocidad
  (`stillRate 7` / `movingRate 34` contra `14` / `90`). **Dos filtros
  exponenciales en serie suman sus constantes de tiempo**: el asentamiento en
  reposo era de unos 214 ms cuando cualquiera de los dos por separado daba la
  mitad. El segundo estaba deshaciendo el trabajo del primero. Ahora son 16 y
  90, igualados a los del tracker.
- **Recuperadas la inclinación y la guiñada.** La marca de palma se construía
  con los vectores aplanados a `z = 0`, lo que **tiraba dos de las tres
  rotaciones**: la mano podía girar en el plano de imagen y nada más. Medido
  contra una mano plana, una mano cabeceada y una girada daban **exactamente
  cero grados** — no atenuadas, idénticas. El cabeceo está en la profundidad
  entre muñeca y nudillo medio, la guiñada entre los nudillos del índice y el
  meñique.
- **Añadido `hooks/palmFrame.ts`** con nueve pruebas. Construye **dos** marcas:
  una con profundidad para orientar el guante, y una plana para elegir cuál de
  los dos modelos ponerse. Separarlas es lo que permite girar **sin** que vuelva
  el fallo que motivó aplanar — perseguir ruido de profundidad al elegir modelo
  hacía que el guante cambiara de cara a mitad de gesto. Orientar mal un
  fotograma es un bamboleo; elegir mal el modelo reconstruye el rig.
- La base sale ortonormal aunque los dos vectores que la siembran estén
  torcidos, porque los productos vectoriales lo arreglan solos. Una mano real
  tampoco es nunca cuadrada.
- `depthDamping` de 0.45 a 0.75: la rotación se lee de la profundidad ahora, y
  a 0.45 el guante giraba más tarde que la mano.
- **Añadido el mando «Inclinación de la palma»** a `/manos`, y ampliados los
  rangos de los dos de suavizado para que cubran los valores nuevos. En 0
  reproduce el comportamiento viejo, para comparar sin recompilar.

> **Sin verificar con cámara real.** La geometría está probada y el guante se
> dibuja sin errores por el camino del ratón, pero el panel del navegador
> bloquea la cámara, así que nadie ha movido todavía una mano de verdad delante
> de esto.

### Documentación

- **Añadida `docs/`**, 32 archivos repartidos en lógica, modelos, estilos y
  desarrollo. Describen el proyecto **como está**, no como debería estar, y cada
  dato lleva al lado la ruta donde comprobarlo.
- **Reescrito `README.md`.** El anterior era del primer commit y ya era falso:
  describía «cubos agarrables con gravedad simple», no mencionaba el juego de
  café, y afirmaba que no había binarios grandes en el repositorio cuando hay 73
  archivos `.glb`.
- **Añadida la regla del registro** a `AGENTS.md`, fuera del bloque que `next
  dev` regenera, para que valga en sesiones futuras.

### Materiales y post-proceso

- **Arreglado el tone mapping doble.** R3F activa `ACESFilmicToneMapping` por
  defecto, así que la escena llegaba al buffer ya comprimida a LDR y
  `GradePass` le aplicaba `shoulder()` otra vez. Dos hombros apilados aplanaban
  los altos. Peor: el paso de brillo leía valores que three ya había recortado a
  1, **así que nada era nunca lo bastante brillante para derramar y el bloom
  llevaba todo el proyecto sin hacer su trabajo**. Ahora el Canvas del juego usa
  `NoToneMapping` y la pasada de grado es la única dueña.
- **Recalibrado el paso de brillo** en consecuencia: umbral 0.62 → **1.02**,
  knee 0.35 → 0.5. Con valores lineales reales una superficie iluminada queda
  bajo 1 y sólo pasan filamentos, el aro dorado y el estallido.
- **El vapor pasa a `meshBasicMaterial`.** Es un soplo translúcido al 17 % en un
  `instancedMesh`; el sombreado PBR completo no compraba nada visible. La
  calidez que le daban las lámparas va horneada en el color.
- **`Environment` de 64 a 128 de resolución**, para que los reflejos del metal
  dejen de ser papilla. Se cuece una sola vez.

### Las fotografías de los cafés

- **Las tarjetas de receta muestran fotografías recortadas** en vez de una taza
  dibujada en SVG. Una ilustración dice «una web sobre café»; una fotografía
  dice «café».
- Los recortes se sacaron con la máscara de primer plano de Vision y se
  recortaron a sus propios límites, para que una sola altura CSS signifique lo
  mismo en las tres. PNG por el alfa; `next/image` sirve WebP, así que los 608 KB
  del repositorio viajan como unos 40 KB.
- Cada taza **flota** sobre su panel con luz detrás y sombra debajo. Sin las dos
  cosas un recorte se lee como una pegatina.
- Acreditados los tres fotógrafos en el pie.
- Eliminado `components/CoffeeCup.tsx`, el vaso dibujado que sustituyeron.

### La portada y la estructura de rutas

- **Añadida la portada** en `/`. No renderiza nada en 3D: tiene que ser legible
  antes de que se descargue un megabyte de modelos.
- **Añadido `components/Field.tsx`.** Cada sección posee su color, pero **no se
  encuentran en una línea recta**: cada campo hace crecer un labio curvo dentro
  del de arriba, así que la unión es una forma. Tres perfiles distintos, porque
  la misma curva tres veces deja de ser un gesto y se vuelve un estilo de borde.
- El orden de los campos hunde el cambio de tono **por lo oscuro**: entre rojo y
  verde no hay nada salvo barro, así que nunca se les pide encontrarse a plena
  luz.
- **Añadido `components/Botanical.tsx`**: rama de café, granos y colibrí en SVG
  en línea. El color solo no basta — un rectángulo vino plano es sólo eso hasta
  que algo crece dentro desde los bordes.
- **Aplicada la paleta de La Mejor Taza**, tomada del sitio y no inventada.
- Añadidos grano, resplandor que respira y motas a la deriva, para que ningún
  campo sea un relleno plano. Todo anima sólo `transform` y `opacity`, y todo se
  detiene con `prefers-reduced-motion`.
- **Añadido `components/ui.tsx`**: un botón, un panel, una barra y un anillo.
  La consistencia sólo sobrevive a un rediseño si está construida, no recordada.

### Profundidad fuera, colisiones arregladas

- **Retirado el sistema de profundidad por tamaño aparente.** Era la única
  lectura del tracker sin un cero fiable, y hacía que las manos —y lo que
  llevaran— respiraran arriba y abajo con nada más que ruido detrás.
- **Las colisiones eran su síntoma, no un fallo aparte.** `overlap` sólo separa
  dos cosas que están a la misma altura; una altura que parpadea es un objeto
  sólido un fotograma y no el siguiente, **y así es como una cuchara acaba dentro
  de un mortero**.
- **Añadido `carryOver()`** en `solid.ts`: la altura de transporte se **decide**
  desde la geometría, subiendo antes de que las siluetas se toquen y bajando al
  pasar. Seis pruebas nuevas, incluida la que cierra el círculo: a la altura que
  decide, `overlap` ya no tiene nada que separar.
- **Arreglado un fallo latente en la molienda**: la altura se quedaba con el
  valor obsoleto de la etapa anterior, así que el molido empezaba a la
  profundidad equivocada. Ahora `crank` mantiene `CRANK_Z` toda la etapa.
- Eliminados `hooks/handDepth.ts` y su test. Las manos flotan a altura fija y la
  rueda del ratón ya sólo gira la muñeca.

### El laboratorio de modelos

- **Añadida la ruta `/modelos`**: las 13 piezas en plataformas giratorias, al
  tamaño que usa el juego, con sus colliders en wireframe y sus medidas. Caza
  los fallos que sólo aparecen con el modelo en escena y que son miserables de
  encontrar desde dentro de una partida.
- `PIECES` se movió a `kit.tsx` para romper un ciclo de importación que **en
  desarrollo se resolvía a `undefined`** y dejaba la plataforma vacía.

### El minijuego

- **Añadido el juego de café**: tres recetas de cinco etapas, agarre por
  pellizco y puntuación por etapa. Ninguna etapa se repite: una mala sale mal y
  se sigue con peor nota.
- Seis tipos de gesto: colocar, girar, sostener, prensar, agitar e inclinar.
- **Añadida la lógica pura** en `components/coffee/`: recetas, gestos,
  animación, sólidos, líquidos y oleaje. Sin React ni three, así que se prueba
  fuera del navegador.
- **Modelos CC0 de los kits de Kenney**, medidos al cargar y ajustados solos.
  Cada kit trae su propia idea de escala y de qué lado es arriba, y no hay dos
  que coincidan.
- La medición se hace con el clon **desprendido**: un `Box3` de un objeto
  montado está en espacio de mundo, y medirlo después de montarlo centraba dos
  veces — **lo que tiró el mortero fuera de la mesa**.
- **Materiales compartidos para el decorado.** Veinte archivos de mobiliario son
  ochenta materiales físicos distintos, cada uno un shader compilado contra cada
  luz: esa tormenta bastaba para perder el contexto WebGL en el primer
  fotograma.
- **Añadido el local**: suelo, grada, multitud instanciada, pancartas dibujadas
  en canvas, conos de luz y lámparas colgantes.
- La multitud **no son modelos**. Un personaje de bloques a esta distancia y en
  penumbra es una caja; dos primitivas dan la silueta que un kit entero no daba.
- **Añadidos los líquidos**: capacidad real, vertido que conserva volumen,
  derrame que no se limpia solo, y una superficie que resuelve la ecuación de
  onda.
- **Añadido el post-proceso**: buffer a resolución limitada, paso de brillo,
  desenfoque separable y composición con curva filmica, calidez y viñeta.
- Quitado el efecto VHS/PS1 que hubo antes.
- `reactStrictMode: false`, porque el doble montaje construía un segundo
  renderer WebGL completo y **perdía el contexto gráfico**: el juego funcionaba
  en producción y mostraba un lienzo gris en desarrollo.

## Fallos conocidos, sin corregir

Anotados porque están, no porque den igual:

- **Poppins se descarga y no se usa.** `--font-sans` apunta a `--font-roboto`,
  que no está definido en ninguna parte; la fuente cargada es Poppins bajo
  `--font-poppins`. Es una petición de red desperdiciada.
- **`@keyframes steam-rise` está duplicado** en `globals.css` y no lo usa nadie:
  quedó del vaso SVG que sustituyeron las fotografías.
- **Dos bloques de `prefers-reduced-motion`** se solapan.
- **`public/models/crowd/` es 1,0 MB muerto.** Ningún código lo referencia desde
  que la multitud pasó a construirse con primitivas.
- **36 de los 49 modelos de `public/models/cafe/` no se colocan.**
- **El modelo de volumen de `liquid.ts` no está conectado.** Está probado y
  funciona, pero el bucle de etapas lleva un `amount` de 0 a 1 por su cuenta.
- Tokens definidos y sin usar: `--color-wine-deep`, `--color-amber`,
  `--color-forest`, `--color-forest-deep`, `--color-label-4`, `.pill-quiet`.

---

## 3021ce3 — Juego de café y manos desde un modelo articulado

Primera versión del minijuego y el guante articulado movido por los landmarks.

## 390a3bd — Commit inicial

Escena con seguimiento de manos sobre Three.js y MediaPipe.
