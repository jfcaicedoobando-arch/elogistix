
# Backfill de proforma PRO-2026-0956

Continuación del mismo tratamiento que se le dio a las proformas legacy de Elogistix el 2 de julio: actualización directa en base de datos, sin crear registros en la tabla `facturas` y sin pasar por la UI.

## Registro afectado

- **Numero**: PRO-2026-0956
- **ID**: `a69745f6-5676-4901-acb3-5de41d1da247`
- **Org**: Elogistix (`00000000-0000-0000-0000-000000000001`)
- **Estado actual**: `estado_cliente = 'aceptada'`, `estado_proforma = 'pendiente'`
- **Total**: USD 26,400

## Cambios en base de datos (1 UPDATE)

Sobre `public.proformas` donde `numero = 'PRO-2026-0956'`:

- `estado_proforma` → `'facturada'`
- `folio_factura_externa` → `'897'`
- `fecha_facturacion` → `2026-07-06`
- `updated_at` → `now()`

No se toca:
- `estado_cliente` (ya está en `aceptada`, es correcto)
- `factura_id` (queda `NULL` porque no creamos registro en `facturas`, tal como pediste)
- Ningún dato monetario

## Verificación posterior

`SELECT` de la fila para confirmar los 3 campos actualizados y que sigue apareciendo en el listado de proformas facturadas del módulo.

## Notas

- No requiere migración de schema, sólo `UPDATE` con la herramienta de inserts.
- No hay cambios de código, versión ni CHANGELOG (es un fix operativo de datos, igual que el batch del 2-jul).
- Si más adelante Elogistix reporta otras proformas en la misma situación, aplicamos el mismo patrón (idealmente en lote).
