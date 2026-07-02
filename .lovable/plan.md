## Objetivo

Marcar como **aceptadas** todas las proformas de la organización **Elogistix** que actualmente están "pendiente de cliente" y cuya fecha sea anterior al **1 de julio de 2026**. Son datos históricos migrados de una versión previa donde no existía el flujo de aprobación.

## Pasos

1. **Diagnóstico (SELECT)** — Contar cuántas proformas cumplen el criterio antes de tocar nada:
   - `organization_id` = el de Elogistix (lookup por nombre).
   - `estado_cliente = 'pendiente'`.
   - `fecha < 2026-07-01`.
   - `deleted_at IS NULL`.
   
   Esto sirve para que confirmes el número antes de ejecutar el UPDATE.

2. **Actualización masiva (UPDATE vía tool `insert`)** — Sobre las filas que cumplen el filtro anterior:
   - `estado_cliente = 'aceptada'`.
   - `fecha_respuesta_cliente = fecha` de la proforma (para mantener consistencia histórica).
   - `respondido_por = 'migración histórica pre-julio 2026'` en el campo de nota/comentario correspondiente (si existe columna de nota; si no, solo la fecha).

3. **Verificación (SELECT)** — Reconteo post-update: debe quedar 0 pendientes con fecha < 2026-07-01 en Elogistix.

4. **Bitácora + versión** — Registro en `CHANGELOG.md` y bump de `APP_VERSION` (patch) documentando la corrección de datos históricos.

## Alcance / Restricciones

- **Solo Elogistix.** No toca otras organizaciones.
- **Solo `estado_cliente = 'pendiente'`.** Proformas ya rechazadas o aceptadas se dejan intactas.
- **Solo fecha < 2026-07-01.** Las proformas de julio en adelante siguen su flujo normal de aprobación.
- **No se envían emails ni se generan facturas automáticamente** — solo se cambia el estado de aprobación de cliente.
- No se altera el trigger de conversión a factura; queda a discreción del equipo convertir cada una cuando corresponda.

## Detalles técnicos

- Tabla afectada: `public.proformas`.
- Se usará la tool `supabase--insert` (permite UPDATE de datos existentes).
- El `organization_id` se resolverá con un subquery: `(SELECT id FROM organizations WHERE nombre ILIKE 'elogistix' LIMIT 1)`.
- Antes del UPDATE ejecutaré un `SELECT COUNT(*)` con los mismos filtros usando `supabase--read_query` para reportarte el número exacto de filas afectadas.

¿Procedo?
