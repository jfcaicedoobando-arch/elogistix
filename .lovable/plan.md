# Tipo de cambio DOF por fecha oficial del documento

## Problema actual (verificado)

- `embarques.tipo_cambio_usd/eur` se siembra con el DOF **del día en que se crea el expediente** (trigger `_embarques_sembrar_tc_dof`) y queda fijo para siempre.
- `pnl_financiero_embarque()` lee ese T/C del embarque y **ignora** `facturas.tipo_cambio`, aunque la factura timbrada traiga otro valor.
- `eerr_resumen_anual()` prefiere el T/C del embarque sobre el de la factura.
- Resultado: una factura emitida meses después del expediente se valúa con un T/C viejo, y el margen en MXN no cuadra con el CFDI.

## Regla única acordada

Para cada documento se resuelve el T/C en este orden:

1. `tipo_cambio` capturado/timbrado del propio documento (CFDI = autoritativo).
2. DOF vigente en la **fecha oficial** del documento.
3. T/C del embarque (último recurso, para no perder el renglón).

Fecha oficial por tipo de documento:

| Documento | Fecha oficial |
|---|---|
| Factura de cliente | `fecha_emision` |
| Nota de crédito | `fecha_emision` (si no hay, la de su factura) |
| Factura de proveedor | `fecha_emision` |
| Pago / REP | `fecha_pago` |
| Concepto de costo / venta | fecha de emisión de la factura de proveedor ligada; si no hay factura, la fecha del embarque |
| Cotización | fecha de envío (o de vigencia si no hay envío) |

## Qué se va a construir

1. **Resolvedor central en base de datos**: función `public.tc_para_documento(fecha, moneda, tc_documento, tc_embarque)` que aplica la cascada anterior y regresa el T/C usado más su origen (`cfdi`, `dof`, `embarque`, `sin_tc`).
2. **Reemitir los agregadores** para usarla: `pnl_financiero_embarque`, `eerr_resumen_anual`, `cartera_pendiente`, `cxc_aging_clientes`, `cxp_aging_proveedores`, `libro_pagos`, `proveedor_estado_cuenta(_movimientos)`, `conciliacion_resumen` y los agregadores de cotización/costeo.
3. **Trazabilidad visible**: cada renglón convertido expone T/C y origen; se mantiene y extiende el aviso de desviación (`PnlTipoCambioNota`) cuando el CFDI difiere del DOF más de 0.5%.
4. **Excluidos sin T/C**: los renglones sin T/C resoluble siguen contándose en `excluidos_sin_tc` en lugar de valuarse en cero.
5. **Backfill único con bitácora**: RPC que rellena `facturas.tipo_cambio` y `proveedor_facturas.tipo_cambio_usd` faltantes con el DOF de su fecha de emisión, registrando cada ajuste en la bitácora de actividad. No sobrescribe valores existentes.
6. **Cobertura DOF**: si falta el DOF de una fecha, se toma el último publicado anterior (comportamiento actual de `tc_dof_vigente`) y se reporta el faltante en el módulo de auditoría.

## Detalles técnicos

- Migraciones nuevas con bloque `REVOKE/GRANT` en el mismo archivo (regla H6) y filtros `deleted_at IS NULL` en todos los JOIN (borrado lógico estricto).
- `a_mxn()` se conserva como conversor puro; el resolvedor de fecha vive aparte para no romper su inmutabilidad.
- Archivos espejo en `supabase/schema/` para cada función reemitida y actualización del manifest/baseline del auditor.
- Frontend: los servicios de tesorería, compras y reportes consumen el T/C y el origen que ya entrega la RPC; no se recalcula en cliente.

## Pruebas

- Suites RLS/SQL: factura emitida 3 meses después del expediente valuada con su propio T/C; factura sin T/C valuada con DOF de su fecha; documento sin DOF disponible cae al T/C del embarque; renglón sin T/C cuenta como excluido.
- Tests unitarios de los mapeadores de reportes y del aviso de desviación.
- Backfill: prueba de idempotencia (segunda corrida no cambia nada).

## Entrega

Se registra en `CHANGELOG.md` y se sube `APP_VERSION`.
