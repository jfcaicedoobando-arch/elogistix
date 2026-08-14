# Filtros estrictos de borrado lógico (deleted_at) en reportes financieros y de antigüedad

## Qué encontré (verificado hoy contra la base de datos)

- 44 tablas tienen la columna `deleted_at` (facturas, pagos_factura, proveedor_facturas, pagos_proveedor, conceptos_costo/venta, embarques, notas de crédito, movimientos bancarios, etc.).
- Las funciones de antigüedad y cartera **sí** filtran la tabla principal: `cxp_aging_proveedores`, `cxc_aging_clientes`, `cartera_pendiente`, `profit_por_cliente` y las vistas `v_proveedor_facturas_saldo`, `v_saldos_cuentas_bancarias`, `v_pagos_rep_pendientes`, `cxp_alertas_vencimiento`, `v_proforma_factura_link`.
- **El hueco real está en las tablas unidas (los "padres")**. Ejemplo confirmado en `libro_pagos`: filtra `pagos_factura.deleted_at IS NULL` y `pagos_proveedor.deleted_at IS NULL`, pero une a `facturas` y `proveedor_facturas` **sin** exigir `deleted_at IS NULL`. Resultado: si se borra lógicamente una factura, sus cobros siguen apareciendo en el Libro Maestro y en los totales.
- Otras funciones muestran la misma asimetría (más tablas referenciadas que filtros presentes) y hay que revisarlas una por una: `libro_pagos`, `pnl_financiero_embarque`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`, `eerr_resumen_anual`, `estado_cuenta_bancario`, `conciliacion_resumen`, `facturas_cartera_cliente`.
- `reportes_resumen` no filtra directo, pero se apoya en `profit_por_cliente`, que sí filtra: no requiere cambio.

Analogía: cada reporte revisa que el recibo no esté en la basura, pero no revisa si la factura a la que pertenece ya se tiró. El recibo sigue contando dinero de un documento que ya no existe.

## Qué voy a hacer

### 1. Cerrar el hueco en las funciones y vistas de reporte
Re-emitir (mismo nombre y firma, sin cambiar contratos ni columnas devueltas) las funciones de reporte para que **toda** tabla con `deleted_at` incluya `deleted_at IS NULL`, tanto en el `FROM` como en cada `JOIN`/`LEFT JOIN` (en los `LEFT JOIN` la condición va en el `ON`, para no convertirlos en `INNER`).

Alcance: `libro_pagos`, `cartera_pendiente`, `cxc_aging_clientes`, `cxp_aging_proveedores`, `facturas_cartera_cliente`, `estado_cuenta_agregados`, `estado_cuenta_bancario`, `conciliacion_resumen`, `dashboard_facturacion_kpis`, `eerr_resumen_anual`, `pnl_financiero_embarque`, `proveedor_estado_cuenta`, `proveedor_estado_cuenta_movimientos`, y las 6 vistas del esquema público.

Antes/después de cada cambio comparo los totales del reporte para que ninguna cifra "buena" se mueva (sólo deben bajar los renglones ligados a documentos borrados).

### 2. Guardrail permanente a nivel base de datos
Agregar el chequeo a `scripts/db/integrity-guard.sql` (ya corre en CI como `audit:db-integrity`): recorre las definiciones de funciones y vistas del esquema `public` marcadas como objetos de reporte financiero y **falla** si alguna referencia a una tabla con `deleted_at` no tiene su filtro correspondiente. Con lista de excepciones explícita y comentada (por ejemplo funciones de bitácora que sí deben ver registros borrados).

### 3. Pruebas
Nueva suite `supabase/tests/rls/test_soft_delete_reportes.sql`, registrada en el grupo `financiero` del workflow `rls-tests.yml`:
- Se crea factura + cobro, se verifica que aparecen en `libro_pagos`, aging y estado de cuenta.
- Se borra lógicamente la factura padre y se verifica que **desaparecen** de los tres reportes y de los totales/KPIs.
- Igual para CxP (proveedor_facturas + pagos_proveedor) y para conceptos de costo/venta en el P&L.

### 4. Bitácora
Actualizar `CHANGELOG.md` y subir `APP_VERSION` (minor).

## Notas técnicas

- Todo el cambio de base de datos va en una sola migración con `CREATE OR REPLACE`; no se altera ninguna estructura de tabla, ni RLS, ni grants.
- Se conservan `SECURITY DEFINER`, `SET search_path`, validaciones `LC_ORG_*` y firmas exactas para evitar drift de baseline y romper `audit:schema-functions` / `audit:rpc-columns`.
- Se agregan los archivos espejo en `supabase/schema/**` para mantener `audit:replay-mirror` en verde.
- Las suites RLS sólo corren en CI (el usuario local no puede simular sesiones), así que la validación final se confirma en el pipeline.
