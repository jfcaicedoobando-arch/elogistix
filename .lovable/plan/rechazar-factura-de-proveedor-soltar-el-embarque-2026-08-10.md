# Rechazar factura de proveedor = soltar el embarque

Hoy rechazar una factura sólo cambia su sello de aprobación: FP-000114 sigue `Vigente`, sigue amarrada al embarque ELIMP00295, sus 4 vínculos de conceptos siguen vivos (incluido el ajuste de −72 USD) y el archivo del proveedor sigue marcado como "capturada". Resultado: el costo "Cargos en Destino" del embarque se ve como ya facturado aunque la factura fue rechazada.

## Comportamiento nuevo al rechazar

1. Se revierten los **conceptos de ajuste** que generó esa factura en el embarque (los `Ajuste factura ...`).
2. Se **borran los vínculos** factura ↔ conceptos de costo, así el costo original vuelve a contar como **pendiente de factura** en el embarque y en la bandeja "Por capturar".
3. La factura **suelta el embarque** (queda sin expediente asociado).
4. El archivo XML/PDF de la bandeja del embarque queda **Rechazado**, con el motivo del rechazo visible (no vuelve a pedir captura).
5. La factura queda **Cancelada** automáticamente, con el motivo del rechazo como motivo de cancelación, fuera de saldos de cuentas por pagar.

## Reglas de seguridad

- Si la factura ya tiene **pagos aplicados** o está **Pagada**, el rechazo se bloquea con un mensaje claro: primero hay que anular los pagos. Esto evita dejar pagos apuntando a una factura cancelada.
- Todo ocurre en una sola transacción dentro de la base de datos: o se aplica completo, o no se aplica nada.
- Se registra en bitácora (`rechazar_factura_proveedor`) el detalle: vínculos eliminados, ajustes revertidos y embarque liberado.

## Aviso en pantalla

En el diálogo "Rechazar factura" se agrega una advertencia explícita antes de confirmar: al rechazar se cancela la factura, se libera el embarque y los costos vuelven a quedar pendientes de factura. Tras rechazar, el detalle del embarque y la bandeja de compras se refrescan solos.

## Corrección de datos de FP-000114

Se aplica el mismo tratamiento al caso ya existente (es la única factura rechazada hoy): se revierte su ajuste de −72 USD, se borran sus 4 vínculos, suelta ELIMP00295, su archivo entrante queda Rechazado y la factura pasa a Cancelada con motivo "Factura cancelada".

## Detalles técnicos

- **Migración**: nueva función `public._cxp_desvincular_por_rechazo(uuid, text)` (SECURITY DEFINER) y extensión de `public.aprobar_factura_proveedor` en la rama `p_aprobar = false`:
  - valida `pagos_proveedor` sin pagos vivos y `estado <> 'Pagada'` → si no, `LC_CXP_RECHAZO_CON_PAGOS`;
  - marca `estado_aprobacion = 'rechazada'` (como hoy);
  - cancela con `set_config('app.cancelando_cxp','1', true)` para pasar `guard_estado_proveedor_factura`, lo que dispara `tg_reverse_ajustes_factura_proveedor` (revierte ajustes) y `_reabrir_entrantes_factura`;
  - después del cancel, `DELETE FROM proveedor_facturas_conceptos WHERE proveedor_factura_id = p_id`, `UPDATE proveedor_facturas SET embarque_id = NULL`, y `UPDATE embarque_facturas_entrantes SET estado = 'rechazada', rechazo_motivo = p_motivo` (sobrescribe el `por_capturar` que dejó el trigger, conservando `proveedor_factura_id` para trazabilidad).
- **Frontend**:
  - `src/features/cxp/services/aprobacionFactura.ts`: nueva regla de error `LC_CXP_RECHAZO_CON_PAGOS` y mensaje amigable en `src/lib/errors/lcCodeMessages.*`.
  - `src/features/cxp/components/DialogDetallePagosProveedor.aprobardialogs.tsx`: advertencia de consecuencias en el diálogo de rechazo.
  - `src/features/cxp/hooks/useAprobarFactura.ts`: invalidar también las queries de embarque, `conceptos_costo`/costos con factura y facturas entrantes.
- **Datos**: script de corrección para `FP-000114` (`a085f3b2-…`) replicando la misma secuencia.
- **Pruebas**: test SQL en `supabase/tests/` (rechazo libera embarque y conceptos; rechazo con pagos falla) y test unitario del mapeo de error nuevo.
- **Versión**: `APP_VERSION` 13.493.0 + entrada en `CHANGELOG.md`.
