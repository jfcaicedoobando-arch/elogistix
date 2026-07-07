# Habilitar "Registrar pago" en facturas legacy

## Diagnóstico

La factura **638** está en estado **Emitida** pero no tiene `uuid_fiscal` (fue timbrada antes del corte del sistema, `fecha_emision = 2026-01-15`, previo al 01/07/2026).

La lógica actual en `deriveFacturaFlags` (`src/features/facturacion/domain/facturaFlags.ts`) exige:

```
timbradaVigente = !sinTimbrar && estado === "Emitida"
puedeRegistrarPago = timbradaVigente && canEdit && saldo > 0.01
```

Como `uuid_fiscal` es `NULL`, `sinTimbrar = true` → `timbradaVigente = false` → el botón "Registrar pago" no aparece en la barra superior (`FacturaDetalleActionsBar`).

**Analogía:** es como una factura de papel que se timbró en la ventanilla del SAT antes de que existiera el sistema. El sistema la reconoce como "Emitida", pero como no tiene su "código de barras" (UUID) interno, bloquea el cobro.

## Cambios propuestos

### 1. `src/features/facturacion/domain/facturaFlags.ts`
- Introducir noción de **factura vigente cobrable**: `estado === "Emitida"` y no cancelada/sustituida, independiente de si tiene `uuid_fiscal`.
- `puedeRegistrarPago = esVigente && canEdit && saldo > 0.01` (permite legacy).
- `puedeCancelarCfdi` y `puedeSustituirCfdi` se mantienen limitados a facturas con `uuid_fiscal` (no se puede cancelar en el SAT algo que no está timbrado aquí).

### 2. `src/features/facturacion/hooks/useRegistrarPagoSubmit.ts`
- Si la factura es PPD **pero** no tiene `uuid_fiscal` (legacy), omitir el timbrado automático de REP. El pago se registra normalmente; no se intenta llamar a FacturAPI.
- Log claro en consola/toast: "Pago registrado. REP no aplicable (factura legacy)."

### 3. `src/features/facturacion/components/detalle/FacturaDetalleActionsBar.tsx`
- Sin cambios de lógica; ya reacciona a `flags.puedeRegistrarPago`.

### 4. Tests
- `src/features/facturacion/domain/__tests__/facturaFlags.test.ts`: caso "factura Emitida sin uuid_fiscal con saldo" → `puedeRegistrarPago = true`, `puedeCancelarCfdi = false`.
- Test del submit hook: pago PPD sin `uuid_fiscal` no dispara `emitirRep`.

### 5. Metadatos
- Bump `APP_VERSION` a `13.213.26`.
- Entrada en `CHANGELOG.md` describiendo el fix.

## Alcance / no incluye

- No cambia la política de timbrado: facturas legacy siguen sin poder timbrarse desde el sistema (`puedeTimbrarDesdeSistema` sin cambio).
- No modifica RLS ni servicios de pagos.
- No toca portal cliente.

## Verificación

- Abrir factura 638 con usuario admin: aparece "Registrar pago" en la barra superior.
- Registrar un abono parcial: se guarda, saldo baja, no intenta timbrar REP.
- Facturas normales (con UUID) siguen disparando REP automático si son PPD.
