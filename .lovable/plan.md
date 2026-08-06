# Arreglo del saldo bancario de BBVA USD

## Qué está pasando

El saldo de BBVA USD está inflado porque un pago a proveedor se registró en el banco **convertido a pesos**, aunque la cuenta es en dólares.

Datos reales de la cuenta BBVA USD:

- Saldo inicial: 38,773.54 USD
- Movimientos vivos (cargos): 406,938.455 + 564.60 + 191.80
- El cargo de 406,938.455 corresponde al pago de la factura DEBIT260676108 de HK LS LIMITED, que en `pagos_proveedor` está registrado como **23,650.00 USD** (TC 17.2067). Alguien lo multiplicó por el tipo de cambio: 23,650 × 17.2067 = 406,938.455.

Resultado: la cuenta en dólares queda con saldo negativo enorme en lugar de 38,773.54 − 23,650 − 564.60 − 191.80 = **14,367.14 USD**.

## Causa

En el código que crea el movimiento bancario de un pago a proveedor existe un ayudante `cargoEnMxn` que **siempre** convierte USD a MXN, sin fijarse en la moneda de la cuenta. Las RPC del backend (anticipos, pago programado) sí guardan el importe en la moneda nativa de la cuenta, así que el frontend es el único que descuadra.

Analogía: la libreta de la cuenta en dólares se está llenando con cifras en pesos; las sumas quedan mezcladas.

## Qué voy a hacer

1. **Corregir la lógica del cargo**: el movimiento bancario se registra siempre en la moneda de la cuenta. Si el pago y la cuenta están en la misma moneda, se guarda el importe tal cual; sólo se convierte cuando realmente difieren (y con el tipo de cambio en la dirección correcta).
2. **Bloquear la mezcla de divisas**: si la cuenta seleccionada no coincide con la moneda del pago, mostrar un error claro en el formulario de pago a proveedor, igual que ya lo exigen los anticipos y el pago programado.
3. **Corregir el movimiento existente** de HK LS LIMITED: dejar el cargo en 23,650.00 USD para que el saldo de BBVA USD vuelva a cuadrar.
4. **Revisar el resto de las cuentas** por si algún otro movimiento quedó convertido de más, y corregirlo igual.
5. **Test de regresión** que verifique que un pago en USD desde una cuenta en USD genera un cargo de 23,650 y no de 406,938.
6. Actualizar `CHANGELOG.md` y `APP_VERSION`.

Aparte (no lo cambio sin tu confirmación): el **saldo inicial de BBVA USD (38,773.54) es idéntico al de BBVA MXN**, lo que parece un dato copiado al dar de alta la cuenta. Dime el saldo inicial real y lo ajusto.

## Detalle técnico

- `src/features/cxp/services/pagoProveedorMovimiento.ts`: reemplazar `cargoEnMxn` por `cargoEnMonedaCuenta(monto, monedaPago, monedaCuenta, tcUsd)`; el input recibe la moneda de la cuenta.
- `src/features/cxp/services/pagoProveedorBitacora.ts`: usar la misma función para el campo del cargo registrado en bitácora.
- Validación en `pagoProveedorValidaciones.ts` / `PagoProveedorForm`: cuenta y pago deben compartir moneda.
- Corrección de datos: `UPDATE bbva_movimientos SET cargo = 23650.00, saldo = NULL WHERE id = 'd6e5233b-39d3-4751-9033-7e4cb53f62e5'` (vía herramienta de datos).
- Test nuevo en `src/features/cxp/services/__tests__/`.
