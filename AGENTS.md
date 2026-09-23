<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Registro de cambios

Todo cambio en este proyecto se anota en `CHANGELOG.md`, bajo «Sin publicar».

Una entrada dice **qué** cambió y, cuando la razón no es obvia, **por qué**.
Este proyecto tiene decisiones que sólo se entienden sabiendo qué se rompió
antes; un «arreglado» sin el fallo que arreglaba no sirve de nada dentro de seis
meses.

Si tocas el código y no lo anotas, el cambio no está hecho.

## Documentación

`docs/` describe el proyecto **como está**, no como debería estar. Al cambiar el
comportamiento de algo que esté documentado ahí, actualiza el documento en el
mismo cambio.

Empieza por `docs/convenciones.md`: el mundo es **Z-up** y eso contradice lo que
hace three por defecto.
