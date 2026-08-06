# Pago en lote a proveedor

Registrar una sola salida de dinero (una transferencia real) contra varias facturas del mismo proveedor, con una sola referencia bancaria, y que el sistema reparta el importe automáticamente.

## Cómo se va a usar

1. En **CxP — Por pagar**, el contador selecciona con las casillas varias facturas del mismo proveedor y la misma moneda.
2. Aparece el botón **Pagar en lote (N)** junto al de "Programar pago".
3. En el modal captura una sola vez: cuenta bancaria, fecha, método de pago, referencia, tipo de cambio (si aplica) e **importe total transferido**.
4. Al escribir el importe, el sistema lo reparte **FIFO por vencimiento**: llena por completo la factura más antigua, luego la siguiente, y la última puede quedar parcial. Cada renglón es **editable**; se muestra en vivo "Repartido / Total / Sin asignar".
5. Botón **Usar saldo completo** para autollenar el total con la suma de saldos.
6. Al confirmar, se crean los pagos de cada factura y **un solo movimiento bancario por el importe total** en Conciliación bancaria.

## Reglas de negocio

- Selección mixta bloqueada: si hay más de un proveedor o más de una moneda, el botón se deshabilita con el motivo visible ("Selecciona facturas de un mismo proveedor y moneda").
- La moneda de la cuenta bancaria debe coincidir con la moneda de las facturas (misma validación que el pago individual; evita el bug de saldos convertidos a MXN).
- Ningún renglón puede exceder el saldo de su factura; la suma repartida debe ser exactamente igual al importe total.
- No se permiten facturas canceladas, ya pagadas, ni sin aprobación cuando el flujo de aprobación la exige (se reutilizan las validaciones actuales de pago).
- Todo o nada: si un renglón falla, no se guarda ningún pago del lote.
- Cada pago hereda la misma referencia y fecha, y queda ligado al lote para poder verlos juntos.

## Detalles técnicos

**Base de datos (una migración)**
- Nueva tabla `public.pagos_proveedor_lote`: `organization_id`, `proveedor_id`, `fecha_pago`, `moneda`, `monto_total`, `tipo_cambio_usd`, `metodo_pago`, `referencia`, `cuenta_bancaria_id`, `notas`, `created_by`, timestamps, `deleted_at`. Con GRANTs (`authenticated`, `service_role`), RLS por organización y trigger de `updated_at`.
- `pagos_proveedor.lote_id uuid` → FK a la nueva tabla (indexado).
- `bbva_movimientos.pago_proveedor_lote_id uuid` → FK a la nueva tabla; se agrega como cuarto origen válido en `assert_movimiento_pago_consistente` (sigue siendo "un solo origen a la vez") y valida moneda cuenta vs moneda del lote.
- RPC `registrar_pago_proveedor_lote(p_payload jsonb)`: valida proveedor/moneda/saldos/cuenta, inserta el lote, inserta N filas en `pagos_proveedor` con `lote_id`, e inserta **un** movimiento en `bbva_movimientos` con `cargo = monto_total`, `hash_dedupe = 'lote-'||id`. Todo en una transacción; errores con códigos `LC_LOTE_*`.
- Ajustar `conciliacion_resumen` y las vistas/consultas de tesorería que ya filtran `deleted_at` para reconocer el nuevo origen de movimiento.

**Frontend**
- `src/features/cxp/services/pagoProveedorLote.ts`: `repartirFifo(saldos, total)` puro + `registrarPagoProveedorLote()` (llama la RPC).
- `src/features/cxp/hooks/usePagoProveedorLote.ts`: mutación + invalidación de `cxp`, `proveedorFacturas`, `tesoreria`, `bandejas`, `bitacora`.
- `src/features/cxp/components/DialogPagoLoteProveedor.tsx` (+ archivo de renglones para respetar el límite de 200 líneas), usando `FormDialogShell` / `FormDialogSection` y `DatePickerMx`, tokens del design system, sin colores hex.
- `CxpPorPagar.tsx`: derivar `mismoProveedor` / `mismaMoneda` de la selección, botón nuevo y apertura del modal.
- En el detalle de factura de proveedor, enlace informativo "Parte de un pago en lote (referencia X)" cuando el pago tenga `lote_id`.

**Pruebas**
- Unit tests de `repartirFifo` (importe menor, exacto, mayor al saldo, redondeo a 2 decimales, orden por vencimiento).
- Test de guardias de selección (proveedor/moneda mixtos) y de que el importe repartido debe cuadrar.

**Cierre**
- Nueva entrada en `CHANGELOG.md` y bump de `APP_VERSION`.
