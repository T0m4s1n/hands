# Registro de cambios

Todo cambio en el proyecto se anota aquí. Si tocas el código y no lo anotas, el
cambio no está hecho.

Formato: lo más reciente arriba. Cada entrada dice **qué** cambió y, cuando la
razón no es obvia, **por qué**. Un «arreglado» sin el fallo que arreglaba no
sirve de nada dentro de seis meses.

---

## Sin publicar

### Acercar la mano ya no mata el molino

- Un close-up **sigue siendo una mano**. El filtro de calidad la tiraba
  como si la palma fuera una pared, y MediaPipe soltaba la presencia
  en cuanto los dedos tocaban el borde.
- El aim de cerca **ya no empuja el guante al frente** de la barra.
  Y el agarre de la manivela vale en todo el molino, no sólo en la
  punta: no hace falta recostarse al lente para alcanzarla.

### El molino ya no se tepea al moler

- La manivela **ya no copia el atan2 crudo** de la mano. Un salto del
  tracker (mano que sale o entra de cámara) se ignora: el mango se
  queda donde estaba. Tampoco gira con una mano en costa.
- Al agarrar otra vez, la manivela **no vuela** hasta el nuevo ángulo
  de la muñeca.

### El puntero de la carta ya no tiembla

- El retículo **ya no come el 72% del salto cada frame**. Sigue el
  índice por tiempo real: casi quieto con el pulso de la webcam,
  más ágil solo cuando la mano de verdad se mueve.

### El puntero de la carta ya no salta de mano

- El menú **traba el índice a la muñeca**, no a Left/Right. Esas
  etiquetas se intercambian y el retículo iba y venía entre las dos
  palmas; la carga se reiniciaba y el pedido no cerraba.
- Un lock nuevo tiene `lockId` propio. Un flip de chirality ya no
  cuenta como otra mano.

### El vaciado se lee y la mano deja de pelearse

- El vaciado ahora tiene **arranque, vuelco y espera**: la muñeca y
  la cuchara usan la misma curva; los granos salen de la pala y
  rebotan en el bowl.
- El guante **ya no se imanta** al acercarse a un objeto. Un puño
  flojo de webcam no agarra. El aim vuelve a la palma, no a un
  close-up corregido de más.

### La mano ya no se hunde al acercarla

- Acercar la mano a la cámara agranda la imagen y **empuja la muñeca
  al borde de abajo**; eso se leía como el guante cayendo al frente
  de la barra. El aim sale de los nudillos y un close-up se levanta.
- La altura queda fija en `HAND_HOVER`. El agarre ya no tira el
  modelo contra la mesa.

### Cada herramienta tiene su agarre

- El pulgar **sigue a los otros cuatro dedos**. Ya no usa su landmark
  propio: ese salto era el movimiento raro.
- Cada herramienta tiene una **pose diseñada** (manivela, cuchara,
  taza, jarra, tetera, filtro, portafiltro, prensador). Al acercarse
  el puño busca el mango; al agarrar se sienta encima y lo envuelve.

### El puño cierra de verdad

- MediaPipe deja un puño de selfie **casi recto en 3D**; solo se
  aplasta en la imagen. El pliegue ahora usa ese colapso en XY, no
  solo la flexión 3D, y un puño a medias ya cuenta para el latch.
- El monigote cierra con ease-out, suelo 0,88 al agarrar, y el pulgar
  se cruza. Cerrar es más rápido que abrir.

### El guante deja de temblar en reposo

- En vivo se perseguía **siempre** a 120/48: el ruido de la webcam
  (unos milímetros de muñeca) iba directo al modelo. Ahora el chase
  es lento bajo un umbral y solo se abre en un gesto de verdad.
- La palma cree menos la profundidad (tilt 0,28) y los cuatro puntos
  que la orientan van suavizados. El filtro de luz no cambia si el
  brillo apenas se movió.

### El guante y el esqueleto coinciden

- La mano izquierda **se espejaba dos veces**: `palmFrame` ya apunta +X
  al meñique y encima el guante hacía `scale.x = -1`. El pulgar del
  modelo caía del lado del meñique; los puntos verdes decían lo
  contrario. Ahora ningún lado se vuelve a espejar.
- Orientación y puntos salen de **la misma nube posada** (`hand.posed`),
  no de landmarks crudos en el guante y suavizados en el overlay.
- El seguimiento es más vivo (giro 48, pliegue 22) y se evita el
  segundo pass de luz si la habitación ya está clara.

### El reconocimiento deja de aferrarse a un esqueleto roto

- **No hay un modelo sucesor publicado.** MediaPipe Hands sigue siendo el
  landmarker del navegador; lo que fallaba no era «usar el paquete
  viejo», era mandarle un 480p oscuro y dejar que el tracker ligero
  arrastrara la caja cuando los huesos ya no eran una mano.
- La cámara pide **1280×720** de frente. El fotograma se **espeja,
  reduce a 960** y, si está oscuro, se **levanta la exposición** antes
  de inferir. Un esqueleto colapsado se descarta y se costa.
- Se carga **float32** si existe, si no `float16/latest`, si no el
  float16 pinneado. La profundidad de los dedos sale de
  `worldLandmarks` (más estable) mezclada con el xy de la imagen.
- `minHandPresenceConfidence` vuelve a 0,55 y el tracking a 0,5: si
  el modelo duda, **re-detecta la palma** en vez de seguir un box
  fantasma.

### Una persona, dos manos

- El landmarker ahora **mira hasta cuatro** detecciones y el tracker se
  queda con **dos como máximo**, y sólo si parecen del mismo cuerpo
  (altura, tamaño de palma, distancia tipo hombros). Si hay dos
  extraños en el cuadro, cada uno con una mano, no se les da un
  guante a cada uno: se sigue a uno.
- Quien ya estaba jugando **no pierde los guantes** porque alguien
  cruzó detrás. El par se ancla a las muñecas que ya se seguían.

### La primera vista de `/` vuelve a ser una portada

- **El héroe llena la pantalla.** Titular corto («Prepara café con las
  manos») y la figura a la derecha, a sangre del hueco, sin las fichas
  flotantes de las tres tazas. Esas tazas viven en la carta, no encima
  de la chica.
- **La carta recupera las fotos.** Cada receta alterna taza y texto,
  con el recorte flotando sobre el color del café. El texto solo se
  leía como una lista; ahora se lee como tres bebidas.
- **Los gestos tienen marca.** Un trazo por cada uno, y un segundo
  botón de empezar al pie de esa sección. Las clases nuevas
  (`portada-cup`, `portada-figure`) viven solo en la portada.

### El vertido deja de ser un collar de bolas

- **El chorro era literalmente dieciséis esferas** ensartadas por el arco
  (`sphereGeometry(0.095)` instanciada). Las cuentas son fáciles y son falsas:
  el café no cae como una fila de canicas, y a cualquier caudal real lo que el
  ojo caza son los huecos entre ellas. Se leía como un collar.
- Ahora es **un tubo continuo**: una rejilla fija de 16 anillos × 8 lados que se
  recorre cada fotograma y **no se reconstruye nunca**. Eso importa: regenerar
  una `TubeGeometry` por fotograma es la forma obvia de hacer esto y asigna un
  juego de búferes sesenta veces por segundo, que es como un vertido se
  convierte en un tirón.
- **Deliberadamente no es una simulación de fluidos.** Los fluidos en espacio de
  pantalla o por FBO se ven magníficos y cuestan un presupuesto de fotograma que
  esta escena ya gastó en el café; un tubo cónico con algo de estrangulamiento se
  lee como un vertido desde un metro, que es donde está el jugador.
- **El derrame era un disco plano.** Ahora es una media esfera achatada: un
  charco tiene menisco, se abomba en el borde y recoge un brillo por el centro,
  y un disco no hace ninguna de las dos cosas — iluminado desde arriba es un
  círculo pintado.
- **Subida la altura de vertido** de 1.15 a 2.35. Detalle que costó ver: es un
  **suelo**, no la altura, y `carryOver` ya levantaba la tetera hasta ~1.6 por su
  cuenta. Subirlo a 1.7 compró nueve centésimas y se veía idéntico. El número
  tiene que superar lo que la regla de colisión ya hacía antes de cambiar nada.

### Arreglado

- `useHandCursor` escribía un ref **durante el render**, que es justo lo que el
  React Compiler rechaza. Movido a un efecto.


### La carta, de verdad

- **Se acabaron las barras al sesgo y la tarjeta.** El menú es una
  fotografía a sangre que cambia con el foco, tres nombres grandes a la
  izquierda y el pitch a la derecha, sin hoja. Las barras de Persona 3
  tapaban la sala y se leían como un HUD, no como una carta.
- **Fotos nuevas** (`/cafes/{id}-hero.jpg`): tinto es una jarra de
  filtrado, espresso la crema de cerca, capuchino un rosetón sobre
  madera. Los recortes de arriba (`*.png`) se quedan en la portada.
- **Pedir es dejar la mano** un segundo sobre el nombre, o pellizcar, o
  hacer clic. Una barra ámbar se llena para que se vea venir.

### El iris, al revés, y «Sincronicemos las manos»

- **El iris cierra de afuera hacia adentro** y abre de adentro hacia
  afuera. Antes era un manchón negro que crecía desde el centro (un
  `clip-path` de círculo). Ahora el velo tiene un agujero (`mask` +
  `--iris`) que se pinza y se abre, como un diafragma. El radio va en
  `vmax` para que el círculo se vea la mayor parte del tiempo, no sólo
  al final. El borde va difuminado (`--iris-soft`) y se aprieta al
  cerrar. 880 ms al pinzar, 120 ms en negro, 1040 ms al abrir.
- **Los textos de la sync** pasan a «Sincronicemos» / «las manos». Se
  leía como un rótulo técnico; esto es la instrucción.

### La sincronización, sin tarjeta

- **Ya no es una hoja.** Mismo lenguaje que el permiso: título grande a
  flote y dos palmas SVG. Saludan mientras esperan, se tensan al verse y
  se quedan en ámbar al trabar. La tarjeta tapaba la sala y se leía como
  un diálogo encima del café, no como parte de él. El tiempo no cambia:
  0,9 s para trabar, una mano basta, 0,55 s más y entra el menú.

### El permiso, sin tarjeta

- **Se pide la cámara al entrar.** Si el navegador ya la tenía concedida o
  deja preguntar, no hay menú: el stream llega y sigue el arranque. Si el
  aviso se queda colgado (no hay gesto, o el diálogo no aparece) a los
  2,8 s sale el menú igual. El `getUserMedia` redundante vive en
  `hooks/requestCamera.ts`.
- **Si no se puede**, no hay hoja. Título grande a flote, taza SVG que
  llora (o echa vapor mientras espera), y dos botones en fila:
  «Continuar con el ratón» y «Aceptar cámara». La tarjeta de permiso
  tapaba la sala y se leía como un diálogo, no como el café.

### El arranque, por tramos, con iris

- **Sincronización de manos.** Tras la cámara, hay que dejarlas a la
  vista hasta que una se quede 0,9 s. Las dos es lo educado; con una
  basta. Sin este paso el menú se abría sobre un tracking que aún
  parpadeaba.
- **Iris de Nintendo** entre cada tramo (cierra 420 ms, abre 520 ms).
  Sync, menú, briefing, cuenta atrás, juego y resultados llegan igual.
- **Menú al estilo Persona 3**, en los colores de la casa: tres barras
  horizontales al sesgo a la izquierda. Al pasar la mano, a la derecha
  sale la PNG del café, el `pitch` y las cinco etapas.
- **Briefing que se puede saltar**, tres golpes (pellizca, lleva, una
  vez), y un **3-2-1** en el centro. El juego no arranca debajo del 1:
  arranca cuando el 1 ya se fue.
- **Reseña con estrellas** por proceso y una **factura** con el total.
  `stars()` usa los mismos umbrales que `grade()`, para que un «Muy
  bueno» no salga con cinco estrellas.

### Shaders, manos y las etapas, de verdad

- **El bloom no encendía.** La pasada de grado escribía la escena en un
  destino de 8 bits, que recorta todo a 1, y el umbral del brillo está en
  1.02 a propósito (la escena llega sin tone mapping). Nada pasaba el
  corte, así que el desenfoque trabajaba sobre negro. Los tres destinos
  pasan a `HalfFloatType` en espacio lineal; los de bloom no gastan
  profundidad. El umbral sube a 1.6 y hay exposición 0.62: con HDR de
  verdad el foco de 190 dejaba el mostrador por encima de 1 y la sala
  se iba al melocotón. Exposición 0.44 mete esos valores en el hombro.
- **El cel de la mano era pintura plana.** `meshToonMaterial` muestrea su
  rampa contra la luz acumulada, y el foco de la sala es 190 para que el
  metal haga bloom. Ese número clava cada muestra en el último peldaño.
  Shader propio (`handToon.ts`): half-Lambert contra la cámara, rampa
  `NoColorSpace`, un ribete. El toon de three no puede hacer este trabajo
  en esta sala.
- **Los puntos de `/manos` no coincidían con la mano.** Sólo aplicaban el
  candado de tamaño; se saltaban el estirado de profundidad y la media
  vuelta dorsal, así que con el dorso activo los puntos se quedaban en la
  palma. Extraído `poseCloud` y lo corren los dos.
- **La placa de palma daba media vuelta** cuando la mano iba de canto: el
  palmo entre nudillos se colapsa a ruido y la normal se invierte.
  `keepFacing` rechaza un flip de 180° y deja pasar un giro de verdad.
- **Las etapas no se veían hacer lo que contaban.** La jarra no se
  tambaleaba al agitar, el tamper no bajaba al prensar, el chorro salía
  de un punto fijo y los puntos guía sólo existían en `place`. Ahora cada
  gesto mueve su objeto, el chorro sale del pico al inclinar, y hay guía
  en moler, sostener, verter y prensar — y se apaga al llegar.
- **El sombreado baja solo si el fotograma se arrastra** (tope de píxeles
  de 2.1 M a 720 k) y sube otra vez a 60 fps. El interruptor de bloom no
  se toca. El laboratorio deja el mapa de sombras en 1024²; los granos en
  reposo no reescriben matrices. La pasada de grado se reconstruye si el
  contexto WebGL vuelve.

### La mano: dorso hacia el jugador, y proporciones arregladas

- **El dorso mira al jugador.** Una webcam ve el lado que le apuntes, y lo que
  la gente apunta a una cámara es la palma; al alcanzar algo sobre una mesa uno
  ve el dorso. `turnOver()` le da media vuelta **sobre el eje de la propia
  mano**: una rotación, no un espejo. Espejar mostraría el dorso igual de bien y
  convertiría una mano izquierda en una derecha — el fallo contra el que peleó
  mil líneas el rig viejo. Tres pruebas, una de ellas sobre la quiralidad.
- **Arregladas las proporciones.** El grosor del hueso salía del extremo **más
  fino**, así que cada hueso era más estrecho que el nudillo de encima y cada
  articulación destacaba como una bola en un palo: un racimo de uvas. Ahora sale
  del más grueso, y un nudillo es un bulto en una salchicha.
- **Bajado el grito del oro.** Las articulaciones eran otro *color*, no otro
  *tono*: oro saturado sobre crema se leía como cuentas ensartadas en un hilo
  blanco, y en movimiento las cuentas era lo único que se veía. La mano parecía
  una pulsera.
- **El puño era un donut** que dominaba la imagen: reducido a la mitad.
- **La placa de palma era una paleta** del tamaño de la mano entera, con las
  raíces de los dedos enterradas detrás. Ahora es más pequeña que la mano que la
  lleva y los puntales se ven por los dos lados.

### La mano, de caricatura y con profundidad real

- **Sombreado cel.** Todo pasa a `meshToonMaterial` contra una rampa de cuatro
  escalones planos. El latón deja de ser metal literal y pasa a ser el color con
  el que se dibuja el oro — para una caricatura, el cambio correcto. Los colores
  se subieron de brillo porque la rampa escalona todo hacia lo oscuro.
- **Proporciones gordas**: articulaciones mucho mayores y falanges casi sin
  cono. Una mano de dibujos tiene salchichas por dedos, no husos.
- **Los dedos ya se tapan entre sí.** No había que programar la oclusión —los
  materiales hacen depth test— sino **que hubiera profundidad que ocluir**.
  MediaPipe la reporta a un quinto de la escala de los otros ejes y `WORLD_Z` se
  eligió tímido, cuando sólo decidía la forma de un dedo. Lo que quedaba era una
  mano tan plana que ningún dedo pasaba nunca por detrás de otro, y una mano
  cuyas partes no se tapan no se lee como un sólido por bien sombreada que esté.
  Añadido `deepen()`, que estira la profundidad sobre la muñeca; por defecto
  2.2, por encima de 1 a propósito.
- **Arreglado un deslizador que dejé roto**: «Profundidad de la mano» iba de 0 a
  1 y el valor por defecto pasó a 2.2, fuera de su propio rango.
- Una cápsula habría sido la forma obvia para un hueso y es la equivocada:
  escalarla a la longitud del hueso estira sus tapas en huevos. Cilindro, con
  las esferas de las articulaciones redondeando los extremos.

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
