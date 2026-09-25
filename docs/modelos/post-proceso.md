# Post-proceso

`components/coffee/grade.tsx` (~380 líneas). Cuatro pasadas entre la escena y la
pantalla.

## Las cuatro

1. **Escena → buffer**, a tamaño limitado.
2. **Paso de brillo**: quedarse sólo con lo que puede derramar.
3. **Desenfoque separable**: una pasada horizontal y otra vertical, a un cuarto.
4. **Composición** a pantalla.

Registrada con prioridad `1` (`:270`): "Priority above zero means this owns the
render loop".

## El límite de resolución

`MAX_PIXELS = 2_100_000` (`:49`) — "The most pixels the scene is ever shaded at…
**the first thing to go when the frame rate does.**"

```
shadingSize(w, h): scale = min(1, sqrt(MAX_PIXELS / (w*h)))
```

Se aplica a los dos ejes, así que la proporción se conserva. En una pantalla
ancha a DPR 2 eso ahorra cuatro megapíxeles de sombreado por fotograma, que es
la mayor parte de la diferencia entre sesenta y treinta.

Si el fotograma se pasa de 22 ms durante un rato, el tope baja solo hasta
`MIN_PIXELS = 720_000`; si vuelve a 60 fps un segundo y pico, sube otra vez.
El interruptor de bloom del HUD no se toca.

Los tres destinos son `HalfFloatType` en espacio lineal. Un destino de 8 bits
recortaba todo a 1, y el umbral de 1.02 —escrito para una escena sin tone
mapping— no dejaba pasar nada: el bloom no encendía. Los destinos de bloom
no llevan buffer de profundidad.

## El tone mapping doble

**Éste fue un fallo real, y es la razón de `NoToneMapping` en el Canvas.**

R3F activa `ACESFilmicToneMapping` por defecto. La escena salía ya comprimida a
LDR hacia el render target, y la composición aplicaba `shoulder()` otra vez. Del
comentario en `HandTrackedScene.tsx:300-308`:

> La pasada de grado es la dueña del tone mapping, así que el renderer no debe
> hacerlo también. R3F pone ACES por defecto, lo que significaba que la imagen se
> rodaba dos veces… y peor, **le costaba al bloom su trabajo entero: el paso de
> brillo leía valores que three ya había recortado a 1, así que nada en la
> escena era nunca lo bastante brillante como para derramar.**

## El paso de brillo

`BRIGHT_FRAGMENT` (`:61-77`). Luma Rec.709
`dot(colour, vec3(0.2126, 0.7152, 0.0722))`, y se conserva
`smoothstep(uThreshold, uThreshold + uKnee, luma)`.

Smoothstep y no corte duro: "a hard threshold makes bloom pop on and off as
something drifts past it".

```
uThreshold = 1.6
uKnee      = 0.55
uExposure  = 0.44
```

El umbral **por encima de uno** (`grade.tsx`):

> Porque la escena llega ahora sin tone mapping, y en un destino de 16 bits
> el foco de 190 deja el mostrador en 1–3. Un umbral de 1.02 florecía la
> barra entera y la sala se iba al melocotón. A 1.6 **sólo pasan los altos
> de verdad — filamentos, el aro dorado, el estallido.** `uExposure` mete
> esos valores HDR en el hombro de la curva en vez de recortarlos a 8 bits
> otra vez.

## El desenfoque

`BLUR_FRAGMENT` (`:83-98`). Gaussiana clásica de 5 tomas con muestreo lineal:
pesos `0.2270270270`, `0.3162162162` ×2 a distancia `1.3846153846`, y
`0.0702702703` ×2 a `3.2307692308`.

Separable: "Running it twice along different axes costs a fraction of what one
square kernel of the same reach would." `BLOOM_DIVISOR = 4`.

## La composición

`COMPOSITE_FRAGMENT` (`:100-141`), en orden:

1. `colour = escena + bloom * 0.85`
2. `shoulder(colour * 1.05)` — curva racional estilo ACES con
   `a=2.51, b=0.03, c=2.43, d=0.59, e=0.14`. "Bright things ease toward white
   instead of slamming into it, which is what stops the lamp filaments and the
   gold ring from turning into flat white blobs once the bloom is added on top."
3. **Calidez en las sombras**: `colour *= vec3(1.03, 0.995, 0.955)` — "so the
   shadows are coffee rather than slate. **Costs nothing and does more for the
   mood than another light.**"
4. **Viñeta**: `1.0 - dot(vUv-0.5, vUv-0.5) * 0.32`
5. **Conversión lineal→sRGB a mano**, `toScreen()` (`:108-115`), con la función
   de transferencia a trozos exacta.

### Por qué la conversión va a mano

`:36-39`:

> Tiene que estar aquí: three sólo la aplica cuando dibuja directo al lienzo, y
> cualquier cosa que renderice a través de un buffer primero **tiene que hacerlo
> a mano o la imagen entera sale varios pasos oscura.**

## El rig

`:143-229`, `:241-268`. Tres render targets `RGBAFormat` + `LinearFilter`, un
único quad a pantalla completa con `frustumCulled = false` en su propia escena
con una `OrthographicCamera`, y el material del quad se intercambia entre las
tres pasadas.

El vértice se salta todas las matrices:
`gl_Position = vec4(position.xy, 0.0, 1.0)`.

Se construye una vez en un `useEffect` a 1280×720 nominales y se redimensiona en
el bucle. El porqué (`:249-252`): construirlo dentro del bucle "would mean
assigning a ref that the cleanup below already closes over, **which is exactly
the tangle the React compiler refuses to let through**". Ver
[../convenciones.md](../convenciones.md).

## El interruptor

`export const effects = { bloom: true }` (`:41-42`) — un objeto mutable de
módulo, "Read every frame, so the effects can be switched without a rebuild".
Es lo que conmuta el botón de brillo del HUD.
