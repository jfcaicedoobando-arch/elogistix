# Trazabilidad de pagos: movimiento bancario ↔ factura(s)

Objetivo: que cada pago (cobro de cliente, pago a proveedor, anticipo) muestre con claridad **a qué movimiento bancario** quedó conciliado y **a qué factura(s)** se aplicó, y que desde la pantalla de Conciliación bancaria se pueda abrir ese detalle.

## Qué verá el usuario

1. **Tesorería → Pagos**: al hacer clic en una fila se abre un panel "Detalle del pago" con tres bloques:
   - **Pago**: fecha, contraparte, monto en su moneda, equivalente en pesos, tipo de cambio, método SAT, referencia, cuenta bancaria, notas y quién lo capturó.
   - **Movimiento bancario**: fecha, concepto del estado de cuenta, cargo/abono, referencia, cuenta y quién/cuándo lo concilió. Si no está conciliado, un aviso "Sin movimiento bancario conciliado" con enlace a Conciliación.
   - **Aplicado a**: lista de factura(s) con folio, embarque, monto aplicado y saldo restante. Cubre los tres casos:
     - cobro de cliente → la factura del cliente con el monto aplicado;
     - pago a proveedor individual → su factura de proveedor;
     - pago en lote → todas las facturas del lote con su reparto;
     - anticipo → las aplicaciones registradas del anticipo (o "Sin aplicar todavía" con el saldo disponible).
   - Enlaces directos a la factura, al embarque y al estado de cuenta.
2. **Nueva columna "Aplicado a"** en el libro de pagos: folio cuando es una sola factura, o "N facturas (lote)" cuando son varias.
3. **Conciliación bancaria**: cuando un movimiento ya está conciliado, el panel derecho muestra a qué pago corresponde (contraparte, folio, monto) y un botón **"Ver detalle del pago"** que abre el mismo panel de detalle. Hoy sólo se ve la insignia "Conciliado" sin decir con qué se concilió.

## Detalle técnico

**Base de datos** (una migración):
- Nueva función `public.pago_detalle(p_tipo text, p_id uuid)` (SECURITY DEFINER, filtrada por `organization_id` / `super_admin`, `GRANT EXECUTE` sólo a `authenticated`, revocada de `anon`/`PUBLIC`). Acepta `p_tipo` en `('cobro','pago','anticipo','lote')` y devuelve JSON con:
  - `pago`: datos del encabezado según la tabla origen (`pagos_factura`, `pagos_proveedor`, `anticipos_proveedor`, `pagos_proveedor_lote`).
  - `movimiento`: fila de `bbva_movimientos` ligada por `pago_factura_id` / `pago_proveedor_id` / `anticipo_proveedor_id` / `pago_proveedor_lote_id` (sólo `deleted_at IS NULL`), con alias y banco de `cuentas_bancarias`.
  - `aplicaciones[]`: folio, id de factura, embarque, moneda, monto aplicado y saldo; construido desde `pagos_factura.monto_aplicado_factura`, los hermanos de `pagos_proveedor` con el mismo `lote_id`, o `anticipos_aplicaciones`.
- Se reutiliza la lógica de `libro_pagos` para el equivalente en MXN, sin cambiar esa función.

**Frontend**:
- `src/features/tesoreria/domain/pagoDetalle.ts`: tipos y helpers puros (resolver tipo/id de un movimiento, totales de aplicaciones, saldo pendiente).
- `src/features/tesoreria/services/pagoDetalle.ts`: llamada al RPC con manejo de `error`.
- `src/features/tesoreria/hooks/usePagoDetalle.ts`: query con clave nueva en `queryKeys.ts`, habilitada sólo cuando hay pago seleccionado.
- `src/features/tesoreria/components/DetallePagoSheet.tsx` (+ subsecciones si pasa de 200 líneas) usando los tokens del design system y tablas `DetailTable`.
- `TesoreriaPagos.tsx`: estado de fila seleccionada → abre el sheet; `libroPagosColumns.tsx` gana la columna "Aplicado a" (con `e.stopPropagation()` en enlaces).
- `PanelConciliacionMovimiento.tsx`: bloque "Conciliado con" + botón que abre `DetallePagoSheet` derivando tipo/id de las columnas del movimiento.

**Pruebas**: tests unitarios de los helpers puros de `pagoDetalle.ts` (resolución de tipo desde el movimiento, suma de aplicaciones, saldo) y un test de render del sheet con datos simulados, siguiendo el patrón de mocks thenable de Supabase.

**Cierre**: bump de `APP_VERSION` y entrada nueva en `CHANGELOG.md`.
