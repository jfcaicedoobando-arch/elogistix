## Contexto

Las 5 proformas del CSV están en `estado_proforma = 'pendiente'` sin `factura_id` ni `folio_factura_externa`. Fueron facturadas en el sistema anterior, por lo que los folios (804, 908, 781, 849, 858) no corresponden a facturas actuales en la tabla `facturas` (verifiqué: solo existe un folio 849, pero pertenece a otro cliente — SONOMEDICS, no QUIMCELT).

Como no hay CFDI destino en este sistema, no podemos vincular `factura_id`. La ruta correcta es marcarlas como facturadas externamente usando los campos ya existentes: `folio_factura_externa` y `fecha_facturacion`.

## Cambios

Migración de datos (tool `supabase--insert`, un solo `UPDATE`):

| Proforma | folio_factura_externa | fecha_facturacion |
|---|---|---|
| PRO-2026-0288 | 804 | 2026-03-30 |
| PRO-2026-0277 | 908 | 2026-05-27 |
| PRO-2026-0187 | 781 | 2026-03-10 |
| PRO-2026-0186 | 849 | 2026-04-24 |
| PRO-2026-0185 | 858 | 2026-04-28 |

Set adicional:
- `estado_proforma = 'facturada'`
- `updated_at = now()`

No se toca `factura_id` (queda `NULL` porque no existe CFDI equivalente en el sistema nuevo).

## Detalles técnicos

- Un `UPDATE ... FROM (VALUES ...)` sobre `public.proformas` filtrando por `numero IN (...)`.
- Sin migración de esquema, sin cambios de código, sin bump de `APP_VERSION` (es solo data-fix, análogo a la vinculación previa de v13.308.11).
- Entrada en `CHANGELOG.md` bajo la versión actual documentando el ajuste de 5 registros heredados.

## Verificación

Después del update, correr `SELECT numero, estado_proforma, folio_factura_externa, fecha_facturacion FROM proformas WHERE numero IN (...)` y confirmar que las 5 quedan en `facturada` con los folios/fechas correctos.