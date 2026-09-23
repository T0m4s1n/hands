# Registro de cambios

Todo cambio en el proyecto se anota aquí. Si tocas el código y no lo anotas, el
cambio no está hecho.

Formato: lo más reciente arriba. Cada entrada dice **qué** cambió y, cuando la
razón no es obvia, **por qué**. Un «arreglado» sin el fallo que arreglaba no
sirve de nada dentro de seis meses.

---

## Sin publicar

### La mano se construye sobre los puntos, no sobre un esqueleto

- **Sustituido el guante entero por una mano de autómata.** El guante posaba
  una malla glTF con esqueleto: leía la pose de bind, recorría cada dedo como
  una cadena, resolvía una rotación por hueso y sujetaba cada articulación
  dentro de límites. Mil líneas, todas al servicio de **un solo requisito** —
  una malla con esqueleto tiene longitudes de hueso fijas y hay que
  respetarlas — y ese requisito era la causa de toda la fragilidad:
  - Longitudes fijas obligan a **inventar la profundidad**, lo que exige un
    signo que es indecidible justo donde más importa.
  - Un esqueleto tiene **quiralidad propia**, así que había que elegir entre dos
    modelos espejados y volver a elegir al girar la mano. Elegir mal
    **reconstruía el rig a mitad de gesto**.
  - Resolver rotaciones **en cadena** acumula error: un ángulo malo en un
    nudillo mueve todo lo que hay más allá.

  Los tres fallos de inestabilidad arreglados antes eran el mismo fallo
  asomando por sitios distintos.
- **Ahora cada segmento se dibuja entre los dos landmarks que abarca**, y cada
  articulación donde está su landmark. Ninguna rotación se resuelve; sólo se
  lee. Una mano izquierda sale izquierda porque sus puntos son los de una mano
  izquierda. Un dedo mal leído sale mal él solo, sin arrastrar a la mano.
- **El enfoque ya estaba probado en pantalla**: `LandmarkDots` dibuja así desde
  el principio y nunca se retorció.
- Aspecto: falanges cerámicas cónicas sobre rótulas de latón, placa de palma
  mecanizada y puño. No puede parecer carne y no lo intenta.
- **Borradas ~1.130 líneas** (`GloveHand.tsx`, `hooks/boneAim.ts`) por ~560, y
  con ellas `CHAINS`, los límites articulares, `buildRig`, `readBindPose`,
  `modelChirality`, `trackedDirection`, `constrainDirection`, `MAX_BONE_SLEW` y
  el intercambio de modelo completo.
- Borrados `public/models/hand-left.glb` y `hand-right.glb`: 184 KB que ya no
  referencia nadie.
- **El coste, dicho claro:** los dedos cambian de longitud aparente al girar
  hacia la cámara, porque nada les obliga a conservarla. Es el hecho contra el
  que peleaba la IK. El mando «Profundidad de la mano» lo gradúa.

### Las manos responden y giran

- **Arreglada la inestabilidad que introdujeron los dos cambios de abajo.** El
  guante se retorcía de la nada y dejaba de funcionar. Tres causas, y dos eran
  mías:
  - El signo de profundidad por hueso **conmutaba en un umbral**, así que cada
    vez que la lectura cruzaba la zona muerta el hueso saltaba entre dos
    direcciones opuestas — varias veces por segundo, y con el comportamiento
    más violento justo donde la lectura es menos fiable. Ahora se **mezcla**:
    `signo = lean + (1 - |lean|) · respaldo`. Un hueso ilegible se inclina
    menos en vez de saltar.
  - **La orientación se suavizaba al ritmo de la posición**, y subir ese ritmo
    para quitar el retardo le quitó el amortiguado al giro. Ahora tiene el suyo
    (`turnRate: 11`): un grado de error en la palma barre cada yema por la
    pantalla, un milímetro en una yema mueve una yema.
  - **El cambio de modelo se disparaba con basura.** Sólo comprobaba el sesgo
    entre los dos ejes, y con los dedos doblados el palmo entre nudillos
    colapsa a ruido — que se normaliza como cualquier cosa y cae perpendicular
    bastante a menudo, así que pasaba el control llevando un signo que era cara
    o cruz. Cambiar de modelo **reconstruye el rig**, de ahí el giro repentino.
    Añadido `layoutSpread`, que mide cuánta mano había que medir.

- **Recuperada la profundidad por hueso.** `trackedDirection` reconstruía la
  profundidad de cada hueso con un triángulo rectángulo y le aplicaba **un signo
  calculado una sola vez para toda la mano** — el de «doblar hacia la palma».
  Los quince huesos recibían el mismo. Una mano sostenida en ángulo, con los
  dedos genuinamente a profundidades distintas y el tracker reportándolas bien,
  **no se podía expresar**: todos colapsaban sobre el mismo eje y el modelo se
  quedaba casi plano mientras los puntos de seguimiento al lado mostraban otra
  cosa. Ahora el signo sale de la medida por hueso, con el valor global sólo
  como respaldo bajo una zona muerta del 12 % de la longitud del hueso.
- **Añadido `hooks/boneAim.ts`** con siete pruebas. La magnitud de la Z de
  MediaPipe sigue sin creerse — viene a un quinto de escala y con ruido — pero
  el signo es la parte que sobrevive a eso, y era la que faltaba.
- **Arreglada la superposición de depuración.** Los puntos de `/manos` se
  dibujaban al tamaño aparente de la cámara sobre un guante de tamaño fijo, así
  que los dos nunca cuadraban y **cualquier desacuerdo parecía enorme hubiera o
  no algo roto** — justo en la vista cuyo comentario decía servir para
  distinguir un fallo de seguimiento de uno de modelo. Ahora comparten el mismo
  reescalado, que vive en un sitio único.

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
