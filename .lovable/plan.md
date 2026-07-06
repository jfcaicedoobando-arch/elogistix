## Objetivo

Avanzar 10 proformas de la organización elogistix del estado **aceptada / pendiente** directamente a **facturada**, sin timbrar ni generar CFDI, como parte de la limpieza de datos legacy.

## Proformas objetivo (todas confirmadas en BD, org elogistix, estado_cliente=`aceptada`, estado_proforma=`pendiente`)

- PRO-2026-0330
- PRO-2026-0328
- PRO-2026-0327
- PRO-2026-0281
- PRO-2026-0280
- PRO-2026-0279
- PRO-2026-0277
- PRO-2026-0187
- PRO-2026-0186
- PRO-2026-0185

## Cambios en datos

Un solo `UPDATE` sobre `public.proformas` (mediante la herramienta de insert/update de datos, no migración):

- `estado_proforma` → `'facturada'`
- `fecha_facturacion` → `now()` (si viene nula)
- `factura_id` se deja en `NULL` (no hay CFDI generado — igual que otros 184 registros legacy ya en `facturada` sin `factura_id`)
- `folio_factura_externa` se deja en `NULL` (igual que ~171 registros legacy)
- `updated_at` → `now()`

Se agregará un registro en `bitacora_actividad` por cada proforma indicando el cambio manual "aceptada → facturada (limpieza legacy elogistix)" para trazabilidad.

## Fuera de alcance

- No se timbra CFDI.
- No se toca `estado_cliente` (queda en `aceptada`).
- No se generan `pagos_factura` ni `factura_envios`.
- No hay cambios de código ni de esquema.

## Verificación

Después de aplicar, releer las 10 filas y confirmar `estado_proforma='facturada'` y `fecha_facturacion` seteada.

## Preguntas abiertas

¿Quieres que registre algún `folio_factura_externa` (p. ej. un folio manual que te pase el contador) o los dejo en `NULL` como los otros registros legacy?
