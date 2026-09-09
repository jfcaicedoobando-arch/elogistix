# Regresar proforma PRO-2026-1014 (embarque ELIMP00262)

## Diagnóstico (ya verificado en la base)

- `PRO-2026-1014` pertenece al embarque **ELIMP00262** (estado Cerrado).
- Estado de la proforma: `pendiente` (revisión pendiente, cliente "aceptada").
- Su única factura ligada es **F1021**, que está **Cancelada** (fue timbrada y luego cancelada).
- La función de base `eliminar_proforma_rpc` sólo bloquea si hay una factura viva (no cancelada/sustituida) o si la proforma está en estado `facturada`. **Ninguna de las dos aplica aquí**: la proforma se puede eliminar sin problema.

## Cómo se "regresa" una proforma

En LibreCarga una proforma no regresa a un estado anterior: se **elimina** (borrado lógico) y eso **libera los conceptos de venta** del embarque, que vuelven a quedar pendientes para generar otra proforma cuando corresponda.

## Opciones

### Opción A — Lo haces tú desde la app (recomendada)

1. Abrir el embarque **ELIMP00262**.
2. Pestaña **Facturación**.
3. En **Historial de proformas**, acción **Eliminar** (bote de basura) sobre `PRO-2026-1014`.
4. Confirmar el diálogo.

### Opción B — Lo hago yo como operación de datos

Ejecuto `eliminar_proforma_rpc` con el id `bd6e860b-c6a0-47df-8507-cdb6469c5284` y verifico que:

- La proforma quede en papelera (`deleted_at` no nulo).
- Los conceptos de venta de ELIMP00262 queden liberados (sin proforma ligada).
- `embarques.tiene_proforma` quede en `false` (lo ajusta el trigger).
- Quede registro en la bitácora.

## Qué NO se toca

- La factura cancelada F1021 (queda como histórico).
- El embarque ELIMP00262 (sigue Cerrado), ni importes, ni ninguna otra proforma o factura.

## Notas técnicas

- Sin migraciones, sin cambios de código, sin publicación.
- Si se elige la Opción B: una sola llamada RPC + consultas de verificación de sólo lectura.

Haz lo tu