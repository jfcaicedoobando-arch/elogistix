# Facturas canceladas que siguen vinculadas a los costos del embarque

## Qué pasó (confirmado en la base de datos)

En el expediente **ELIMP00302**, la factura **FP-000042** está con estado **Cancelada** (motivo: "Factura cancelada"), pero:

- sigue con `embarque_id` apuntando al expediente, y
- conserva **4 vínculos** con conceptos de costo directos.

Motivo: cuando una factura se **rechaza** en aprobación, el sistema ya rompe el vínculo (libera los conceptos, suelta el expediente y desmarca el archivo del buzón). Pero cuando se **cancela** (caso "cancelada ante el SAT"), la cancelación sólo cambia el estado y **no rompe nada**. Esa fue la ruta usada aquí.

Además, la vista de conciliación de costos sólo descarta facturas borradas (papelera), no las canceladas: por eso la sigue mostrando como facturado.

Alcance real del problema: **6 facturas canceladas** con **32 vínculos** activos en toda la base.

Analogía: rechazar una factura es "devolverla en la puerta y borrarla de la lista de pendientes"; cancelarla hoy es sólo "ponerle un sello de CANCELADA" pero dejarla pegada en el expediente.

## Qué se va a corregir

1. **Cancelar = desvincular.** Al cancelar una factura de proveedor, el sistema hará lo mismo que al rechazarla: borra los vínculos con los conceptos de costo (vuelven a "sin factura"), suelta el expediente, revierte los conceptos de ajuste generados por esa factura y libera el documento del buzón para poder recapturarlo o retirarlo.
2. **Limpieza de datos existentes (backfill).** Se desvinculan las 6 facturas canceladas que hoy siguen pegadas a expedientes, incluida FP-000042 del 302. No se borran facturas ni conceptos originales: sólo se rompe el vínculo.
3. **Doble red de seguridad en la vista de costos.** La conciliación de costos ignorará las facturas canceladas al sumar "real facturado", aunque quedara algún vínculo suelto. Si un concepto tenía sólo esa factura, volverá a mostrarse como **Sin factura**.
4. **Aviso en pantalla.** En el tab de Costos, cuando un concepto quede liberado por cancelación/rechazo, se mostrará su estado como pendiente de factura, sin importes fantasma.

## Detalles técnicos

- Extraer del flujo de rechazo la parte de desvinculación reutilizable y llamarla también desde `public.cancelar_factura_proveedor` (borrar `proveedor_facturas_conceptos`, `embarque_id = NULL`, liberar `embarque_facturas_entrantes`), respetando el guard `app.cancelando_cxp` y el bloqueo por pagos aplicados.
- Migración de backfill idempotente para las facturas ya canceladas con vínculos, con recálculo del estado de liquidación de los conceptos afectados.
- `reconciliacionCostos.ts` / `.helpers.ts`: filtrar `estado = 'Cancelada'` al construir `FacturaVinculada` (además del filtro por `deleted_at`).
- Tests: SQL de regresión (cancelar libera conceptos y expediente) y unitarios de los helpers de reconciliación.
- Actualizar `CHANGELOG.md` y `APP_VERSION`.
