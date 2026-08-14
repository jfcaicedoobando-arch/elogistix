# Borrado lógico estricto en reportes — Fase 2 (cierre)

La primera fase ya está aplicada en la base (v13.608.0): `libro_pagos`, `cartera_pendiente`, `estado_cuenta_bancario`, `conciliacion_resumen`, `pnl_financiero_embarque`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos` y tres vistas ya filtran `deleted_at IS NULL` también en sus JOINs, con suite de pruebas en CI.

Al revisar el resto de los reportes de antigüedad y resultados quedaron tres pendientes.

## 1. Fuga real en el Estado de Resultados anual

En `eerr_resumen_anual`, el bloque de notas de crédito de proveedor une `proveedor_notas_credito` con `proveedor_facturas` sin exigir que la factura esté viva. Efecto: si se borra una factura de proveedor, su nota de crédito aplicada sigue reduciendo el costo del mes, así que el EERR muestra una utilidad mayor a la real.

Corrección: agregar `AND pf.deleted_at IS NULL` a ese JOIN y re-emitir la función.

## 2. Endurecimiento defensivo en los dos Aging

`cxc_aging_clientes` y `cxp_aging_proveedores` calculan pagos y notas de crédito en subconsultas que unen la tabla de facturas sin filtrar `deleted_at`. Hoy no producen un número equivocado porque el resultado final se une contra el conjunto de facturas ya filtrado, pero el filtro depende de ese detalle y se rompería con cualquier reordenamiento futuro.

Corrección: agregar el filtro en los JOINs internos de ambas funciones para que la regla no dependa del orden de las uniones. Se revisa igual `facturas_cartera_cliente`, `estado_cuenta_agregados` y `dashboard_facturacion_kpis`, que ya cumplen y sólo se confirman sin cambios.

## 3. Guardrail para que no vuelva a pasar

Hoy nada impide que un reporte nuevo olvide el filtro. Se agrega una consulta al guardián de integridad que recorre las funciones y vistas de reportes financieros, detecta las tablas con columna `deleted_at` que referencian y falla si alguna aparece sin su filtro, con una lista blanca acotada y comentada para los casos intencionales.

## Pruebas

Se amplía `test_rls_soft_delete_reportes.sql` con dos aserciones nuevas:

- Una nota de crédito de proveedor cuya factura fue borrada no reduce el costo en `eerr_resumen_anual`.
- Los saldos de `cxc_aging_clientes` y `cxp_aging_proveedores` ignoran documentos borrados y conservan los vivos (control anti-falso-positivo).

## Detalles técnicos

- Una sola migración con `CREATE OR REPLACE FUNCTION` de `eerr_resumen_anual`, `cxc_aging_clientes` y `cxp_aging_proveedores`, cuerpos tomados de la definición viva más los filtros, sin cambiar firmas ni permisos.
- Sincronizar el espejo `supabase/schema/facturacion/cxc_aging_clientes.sql` y añadir migración de replay con timestamp posterior a la Ola 13, para mantener `audit:replay-mirror` verde en instalación limpia.
- Guardrail en `scripts/db/integrity-guard.sql` (estático sobre `pg_get_functiondef` / `pg_get_viewdef`), más entrada en el job de CI que ya lo ejecuta.
- Cerrar con bump de `APP_VERSION` a 13.609.0 y entrada en `CHANGELOG.md`.
