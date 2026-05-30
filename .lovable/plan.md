# Pagos de facturas a clientes — enfoque completo

Permitir registrar pagos (totales y parciales, multi-moneda) sobre facturas emitidas, recalculando automáticamente el saldo y el estado (`Emitida` → `Parcialmente pagada` → `Pagada`).

## 1. Base de datos

Nueva tabla `public.pagos_factura`:

- `id`, `factura_id` (FK facturas), `organization_id` (default `current_user_org_id()`)
- `fecha_pago` (date), `monto` (numeric), `moneda` (enum `moneda`)
- `tipo_cambio` (numeric, opcional — para pagos en moneda distinta a la factura)
- `monto_aplicado_factura` (numeric — monto convertido a moneda de la factura)
- `forma_pago` (text: Transferencia, Cheque, Efectivo, Otro)
- `referencia` (text), `notas` (text)
- `created_by`, `created_at`, `deleted_at`, `deleted_by` (soft delete)

GRANTs estándar + RLS multi-tenant (mismo patrón que `conceptos_costo`: Tenant CRUD para admin/operador/super_admin, viewer SELECT, hide soft-deleted, cliente puede leer pagos de sus propias facturas para el portal).

Nuevo enum value en `estado_factura`: `'Parcialmente pagada'` (si no existe ya).

Trigger `recalcular_estado_factura()` que en INSERT/UPDATE/DELETE de `pagos_factura`:
- suma `monto_aplicado_factura` de pagos no soft-deleted
- si `suma >= factura.total` → estado `'Pagada'`, `fecha_pago = max(fecha_pago)`
- si `suma > 0` → `'Parcialmente pagada'`
- si `suma = 0` → vuelve a `'Emitida'` o `'Vencida'` según `fecha_vencimiento`

Índice en `(factura_id)` y `(organization_id, fecha_pago)`.

Registrar en `bitacora_actividad` desde el código (no trigger) para mantener consistencia con el resto.

## 2. Servicios y hooks

`src/services/pagos-factura/index.ts`:
- `listarPagosFactura(facturaId)`
- `registrarPago(input)` con validación: monto > 0, no exceder saldo pendiente
- `eliminarPago(id)` (soft delete)

`src/hooks/facturacion/usePagosFactura.ts`:
- `usePagosFactura(facturaId)` — query
- `useRegistrarPagoFactura()` — mutation, invalida `facturas` y `pagos_factura`
- `useEliminarPagoFactura()` — mutation

Invalidar `queryKeys.facturas.byOrg` tras cada mutación para refrescar estado/badge.

## 3. UI — Pre-Facturación (`src/pages/facturacion/`)

En `facturacionColumns.tsx`, columna **Acciones** para facturas (no solo gastos):
- Botón "Registrar pago" (visible si `canEdit` y estado ∈ `Emitida`/`Vencida`/`Parcialmente pagada`)
- Menú secundario "Ver pagos" para abrir el detalle

Nuevo componente `DialogRegistrarPago.tsx`:
- Muestra: total factura, pagado acumulado, saldo pendiente
- Form (RHF + Zod): fecha, monto, moneda, tipo de cambio (auto si moneda distinta, usando `useExchangeRates`), forma de pago, referencia, notas
- Validación: no permitir monto que exceda el saldo (con tolerancia 0.01)
- Confirmación previa antes de guardar

Nuevo componente `DialogHistorialPagos.tsx`:
- Tabla de pagos con fecha, monto, moneda, forma, referencia
- Botón eliminar con doble confirmación tipo ELIMINAR (memoria `data-safety-confirmations`)

Badge de estado en la columna existente: `Parcialmente pagada` → color amber (extender `getEstadoColor`).

## 4. Portal del Cliente (`src/pages/portal/PortalFacturas.tsx`)

- Mostrar columna "Pagado" y "Saldo" cuando aplique
- Badge `Parcialmente pagada` visible
- Solo lectura (los pagos los registra el staff)

`PortalFacturacionPendienteCard`: descontar pagos parciales del monto pendiente mostrado.

## 5. Tests y changelog

- Test unitario del trigger (`supabase/tests/rls/`): pagos parciales → estado correcto.
- Test del hook `useRegistrarPagoFactura` (validación de saldo).
- Test del dialog (no permite exceder saldo).
- Bump `APP_VERSION` (12.19.0) y entrada en `CHANGELOG.md` raíz.
- Actualizar memoria `mem://features/shipment-liquidation-status` mencionando el nuevo flujo de pagos a clientes.

## Detalles técnicos clave

- Conversión multi-moneda usa `useExchangeRates` (Frankfurter, ya integrado).
- `monto_aplicado_factura` se calcula en el cliente y se valida en el trigger por defensa.
- Soft delete en lugar de hard delete para auditoría.
- RLS: cliente lee sus pagos vía `factura_id IN (facturas del cliente)`, igual que el patrón de `conceptos_venta`.
- Mantener componentes ≤200 líneas (Power of 10): separar form en sub-componente si es necesario.
