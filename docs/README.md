# Documentación de Café a mano

Un minijuego de barista que se juega con las manos delante de la cámara. Esta
carpeta describe **cómo funciona hoy**, no cómo debería funcionar. Donde el
código y un documento no coincidan, gana el código: cada dato lleva al lado la
ruta del archivo donde comprobarlo.

Los comentarios del código están en inglés y explican el *porqué* de cada
decisión. Son la mejor documentación del repositorio, y estos documentos los
recogen en vez de sustituirlos.

## Por dónde empezar

| Si quieres… | Lee |
| --- | --- |
| Entender el conjunto | [arquitectura.md](arquitectura.md) |
| Tocar código sin romper nada | [convenciones.md](convenciones.md) |
| Arrancar el proyecto | [desarrollo/puesta-en-marcha.md](desarrollo/puesta-en-marcha.md) |

## Lógica

| Documento | Cubre |
| --- | --- |
| [seguimiento-de-manos.md](logica/seguimiento-de-manos.md) | Cámara, MediaPipe, coordenadas, suavizado, pellizco |
| [asignacion-de-manos.md](logica/asignacion-de-manos.md) | Qué detección es qué mano, y por qué no basta la etiqueta |
| [guante.md](logica/guante.md) | El modelo articulado: rig, IK, límites de articulación |
| [bucle-de-juego.md](logica/bucle-de-juego.md) | `CoffeeGame`: estado, agarre, reloj, puntuación |
| [recetas-y-etapas.md](logica/recetas-y-etapas.md) | Los tres cafés y cómo se puntúa cada etapa |
| [gestos.md](logica/gestos.md) | Detectores puros: giro, golpe, vertido |
| [solidos-y-colisiones.md](logica/solidos-y-colisiones.md) | Colliders, apoyo, separación, altura de transporte |
| [liquidos.md](logica/liquidos.md) | Volumen, capacidad, vertido, derrame |
| [oleaje.md](logica/oleaje.md) | La ecuación de onda de la superficie |
| [animacion.md](logica/animacion.md) | Muelles amortiguados y sub-pasos |
| [pruebas.md](logica/pruebas.md) | Qué se prueba y cómo se ejecuta |

## Modelos

| Documento | Cubre |
| --- | --- |
| [kit-y-registro.md](modelos/kit-y-registro.md) | `KIT`, medición automática, el ajuste de escala |
| [materiales.md](modelos/materiales.md) | Pooling de materiales, PBR, el tono cálido |
| [escena.md](modelos/escena.md) | Canvas, cámara, luces, entorno |
| [cafe-y-multitud.md](modelos/cafe-y-multitud.md) | El local, las pancartas y el público |
| [efectos.md](modelos/efectos.md) | Vapor, granos, chorro, derrame, celebración |
| [post-proceso.md](modelos/post-proceso.md) | Las cuatro pasadas y el tone mapping |
| [assets.md](modelos/assets.md) | Qué hay en `public/`, licencias y qué sobra |
| [laboratorio.md](modelos/laboratorio.md) | La ruta `/modelos` |

## Estilos

| Documento | Cubre |
| --- | --- |
| [tokens-y-tema.md](estilos/tokens-y-tema.md) | Variables, paleta de marca, Tailwind v4 |
| [tipografia.md](estilos/tipografia.md) | La escala `t-*` |
| [materiales-de-interfaz.md](estilos/materiales-de-interfaz.md) | Cristal, grano, squircle, foco |
| [movimiento.md](estilos/movimiento.md) | Keyframes y movimiento reducido |
| [campos-y-secciones.md](estilos/campos-y-secciones.md) | `Field`: tonos, curvas, motas |
| [botanica.md](estilos/botanica.md) | Rama, granos y colibrí en SVG |
| [portada.md](estilos/portada.md) | La estructura de `/` |
| [interfaz-del-juego.md](estilos/interfaz-del-juego.md) | HUD, menú, permiso, diagnóstico |

## Desarrollo

| Documento | Cubre |
| --- | --- |
| [puesta-en-marcha.md](desarrollo/puesta-en-marcha.md) | Requisitos, instalación, scripts |
| [configuracion.md](desarrollo/configuracion.md) | Next, TypeScript, ESLint, PostCSS |

## Registro de cambios

Todo cambio en el proyecto se anota en [`../CHANGELOG.md`](../CHANGELOG.md).
Si tocas el código y no lo anotas, el cambio no está hecho.
