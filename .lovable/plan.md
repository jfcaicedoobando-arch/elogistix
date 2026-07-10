## Contexto

Proforma **PRO-2026-0341** (id `06840f08…627d7f`) del embarque **ELIMP00263** (org Elogistix) está marcada como `estado_proforma = 'facturada'` pero `factura_id IS NULL` y no existe ninguna fila en `factura_embarques` que la respalde. Es un residuo de una versión anterior: nunca se facturó realmente.

Sus 2 conceptos de venta quedaron "congelados":

| Concepto | Total | estado_facturacion |
|---|---|---|
| Cargos en Destino | 125 USD | facturado |
| Flete Marítimo | 4,615 USD | facturado |

No hay envíos, ni consolidaciones, ni proformas hijas que dependan de ella (verificado). Es seguro liberar.

## Plan

Un solo cambio de datos (tool `supabase--insert`, que también corre UPDATE/DELETE), en una sola transacción:

1. **Liberar los 2 conceptos de venta** del embarque 263:
   - `estado_facturacion` → `'pendiente'`
   - `proforma_id` → `NULL`
2. **Soft-delete de la proforma 341**:
   - `deleted_at = now()`
   - `deleted_by = NULL` (limpieza operativa, no hay `auth.uid()` en la sesión de servicio)
   - Se conserva la fila para auditoría; deja de aparecer en listados porque todas las queries filtran `deleted_at IS NULL`.

No se toca `factura_embarques` (ya estaba vacía) ni ninguna factura (no existe).

## Verificación post-cambio

- `conceptos_venta` del embarque 263 vuelven a mostrarse como pendientes en la pestaña Financiero y quedan disponibles para incluirse en una proforma nueva.
- `PRO-2026-0341` desaparece del listado de proformas.
- Registro en `CHANGELOG.md` + bump de `APP_VERSION` a `13.252.3` (fix operativo puntual, no hay cambio de código de app).

## Fuera de alcance

- No se investiga el bug histórico que dejó la proforma en ese estado inconsistente (versión antigua ya reemplazada; el auditor `audit:rpc-sync` ya vigila el patrón vigente).
- No se crea una factura nueva; si Alan quiere facturar esos conceptos, lo hará desde el flujo normal una vez liberados.

## Analogía

La proforma 341 es como un ticket de "PAGADO" pegado a una cuenta que nunca cobraste: mientras esté ahí, los platillos (conceptos) siguen marcados como cobrados y no puedes volver a ponerlos en otra cuenta. Vamos a despegar el ticket (soft-delete de la proforma) y a marcar los platillos como "por cobrar" otra vez.