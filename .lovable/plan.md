# Traspasos entre cuentas propias (Tesorería)

## Situación actual (verificada)

Hoy el ERP **no tiene** forma de registrar un traspaso entre cuentas propias. Lo único posible es capturar dos movimientos bancarios sueltos y marcarlos como "Ignorar (comisión, traspaso, etc.)" en conciliación — quedan huérfanos, sin relación entre sí y sin rastro de que fueron el mismo movimiento de dinero.

Lo que sí existe hoy:
- Cuentas bancarias con moneda (`cuentas_bancarias`), hoy: BASE MXN, BASE USD, BBVA MXN, BBVA USD.
- Movimientos bancarios (`bbva_movimientos`) con cargo/abono, estado de conciliación y captura manual (`registrarMovimientoManual`).
- Estado de cuenta con saldo corrido (`TesoreriaEstadoCuenta`) y conciliación (`TesoreriaConciliacion`).

## Qué se va a construir

Un registro de **Traspaso entre cuentas propias** en Tesorería: un solo formulario que genera automáticamente la salida en la cuenta origen y la entrada en la cuenta destino, ligadas entre sí, ya conciliadas y visibles en el estado de cuenta de ambas.

### Flujo del usuario

1. Tesorería → Cuentas (o Estado de cuenta) → botón **"Traspaso entre cuentas"**.
2. En el modal captura:
   - Cuenta origen y cuenta destino (no puede ser la misma).
   - Fecha y referencia.
   - Monto que sale de la cuenta origen.
   - Si las monedas son distintas: **tipo de cambio** (precargado con el DOF del día, editable) y se muestra en vivo el monto que entra a la cuenta destino.
   - **Comisión bancaria** (opcional): monto que se cobra en la cuenta origen.
   - Concepto/nota.
3. Al guardar se crean los movimientos y se muestra un resumen con el efecto en el saldo de ambas cuentas.

### Reglas de negocio

- Origen ≠ destino, ambas de la misma organización y activas.
- Misma moneda: el monto de entrada es igual al de salida, sin tipo de cambio.
- Distinta moneda: se exige tipo de cambio > 0; el monto destino se calcula y se guarda explícitamente (no se recalcula después).
- La comisión es un cargo adicional en la cuenta origen; el destino recibe siempre el monto pactado.
- Los movimientos generados nacen **conciliados** entre sí, así que no ensucian la bandeja de pendientes.
- El traspaso **no** es ingreso ni gasto del negocio: no toca margen de embarques, CxC ni CxP. Solo la comisión se clasifica como gasto operativo.
- Se puede **cancelar** un traspaso capturado por error: revierte (soft-delete) los movimientos generados, siempre que no hayan sido tocados por otro proceso.

## Detalle técnico

**Base de datos**

- Nueva tabla `public.traspasos_bancarios`: `organization_id`, `folio`, `cuenta_origen_id`, `cuenta_destino_id`, `fecha`, `monto_origen`, `moneda_origen`, `monto_destino`, `moneda_destino`, `tipo_cambio`, `comision`, `concepto`, `referencia`, `estado` (`Registrado` | `Cancelado`), `created_by`, `created_at`, `updated_at`, `deleted_at`. GRANTs a `authenticated` y `service_role`, RLS por `organization_id` + rol de tesorería, trigger de `updated_at`.
- Columna `traspaso_id` en `bbva_movimientos` (FK, nullable) para ligar cada pierna con su traspaso.
- RPC `registrar_traspaso_bancario(...)`: valida cuentas/moneda/TC, inserta el encabezado y genera en una sola transacción el cargo en origen, el abono en destino y (si aplica) el cargo de comisión, todos con `estado_conciliacion = 'Conciliado'` y `hash_dedupe` con prefijo `traspaso-`.
- RPC `cancelar_traspaso_bancario(id, motivo)`: soft-delete de las piernas y del encabezado, con registro en bitácora.
- Ambas RPCs escriben en `bitacora_actividad` (módulo `tesoreria`).

**Frontend** (`src/features/tesoreria/`)

- `services/traspasos.ts` — llamadas a las RPCs y listado.
- `domain/traspaso.ts` — validaciones y cálculo del monto destino (puro, con `currency.js` y `financialUtils`).
- `hooks/useTraspasos.ts` — react-query + invalidación de saldos, estado de cuenta y conciliación.
- `components/DialogTraspasoCuentas.tsx` (+ subarchivos de secciones) usando `FormDialogShell`/`FormDialogSection`, `MoneyInput`, `DatePickerMx`.
- Botón de acceso en `TesoreriaCuentas` y en `TesoreriaEstadoCuenta`.
- En el estado de cuenta y en la conciliación, las piernas se etiquetan como "Traspaso" con enlace a la cuenta contraparte.

**Pruebas**

- Unitarias del cálculo (misma moneda, distinta moneda, comisión, redondeo).
- Test SQL de RLS para `traspasos_bancarios` (aislamiento entre organizaciones).
- Test de que el traspaso no altera CxC/CxP ni margen de embarques.

**Cierre**

- Bump de `APP_VERSION` y entrada en `CHANGELOG.md`.
- Archivos nuevos y modificados ≤200 líneas (Power of 10).
