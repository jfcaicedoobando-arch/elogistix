## Último bloque de remediación (hallazgos 17, 18, 19, 20)

Cerramos los 4 hallazgos pendientes de severidad Baja. Sin cambios funcionales ni de UI.

### Paso 17 — Consolidar `TODO`/`FIXME` de auditoría (🟢 Bajo)
- Escanear `rg -n "TODO|FIXME|XXX|HACK"` en `src/` y mover los comentarios con valor accionable a issues internos (`.lovable/audit-todos.md`).
- Eliminar los comentarios obsoletos (ya cerrados por bloques previos).
- Conservar sólo los que apunten a trabajo futuro real, con prefijo `// AUDIT:` y referencia al hallazgo.

### Paso 18 — Tipar respuestas de RPCs sin `as never` / `as any` (🟢 Bajo)
- Auditar `src/features/**/services/*.ts` y reemplazar casts `as any` / `as never` por:
  - tipo del generado (`Database["public"]["Functions"][...]`), o
  - una interfaz local + `fromDb<T>()` ya existente.
- Marcar con `// SAFE-CAST:` los que sigan siendo inevitables (ver `mem://principles/safe-cast`).

### Paso 19 — Limpieza de imports muertos y `console.log` residuales (🟢 Bajo)
- Correr `bunx knip` (config ya existe en `knip.json`) y eliminar exports/imports no usados detectados.
- `rg -n "console\\.(log|debug)" src/` → reemplazar por `logger.*` o eliminar; conservar `console.error`/`console.warn` justificados con comentario.

### Paso 20 — Documentación de arquitectura final (🟢 Bajo)
- Actualizar `reports/audit-report.md` marcando los 20 hallazgos como cerrados, con commit/versión donde se atendió cada uno.
- Añadir sección "Cómo extender" a `CONTRIBUTING.md` con las 5 reglas que surgieron de la auditoría:
  1. Componentes ≤200 líneas.
  2. Sin `SELECT *` en servicios.
  3. Tokens semánticos para colores.
  4. Tests por servicio + hook.
  5. Cleanup obligatorio en `useEffect`.

### Metadatos
- Bump `APP_VERSION` → `13.56.7`.
- Entrada en `CHANGELOG.md` describiendo cierre del plan de remediación (pasos 17–20) y resumen final del recorrido 13.56.1 → 13.56.7.

### Riesgo
Muy bajo: limpieza, tipado más estricto y documentación. Sin cambios de comportamiento.
