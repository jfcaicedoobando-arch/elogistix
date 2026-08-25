# Corregir saldo fantasma en facturas ya pagadas (legacy)

## Diagnóstico confirmado

Se revisaron los datos reales: hay **31 facturas con estado "Pagada" sin ningún pago registrado** (0 renglones de pago), por un total de **~374,631** (casi todo en USD).

El estado de cuenta (ficha del cliente y portal) calcula el saldo como `total − pagos − notas de crédito`, **sin considerar que el estado ya es "Pagada"**. Resultado: esas facturas aparecen con saldo completo y engordan los KPI de "Adeudado" y "Vencido".

La lista de Cobranza sí las excluye correctamente, por eso el problema solo se nota en Estado de cuenta.

## Qué se va a hacer

1. **Regla única de saldo**: una factura con estado `Pagada` (igual que `Cancelada`, `Sustituida`, `Borrador`) siempre reporta saldo 0, no suma al adeudo ni al vencido, y no se cuenta como factura adeudada. Esto se aplica en el mismo lugar en los tres frentes: cálculo en pantalla, agregados en base de datos y PDF/email del estado de cuenta.

2. **Regularizar las 31 facturas legacy**: generar un pago histórico por el total de cada una, marcado claramente como ajuste de migración, en la misma moneda de la factura, con fecha igual a su fecha de emisión, sin timbrado de REP (no genera comprobante fiscal) y sin ligarse a movimientos bancarios ni a conciliación. Así el "pagado" cuadra con el estado y el historial de la factura deja de verse vacío.

3. **Candado a futuro**: verificación automática que falle si vuelve a existir una factura "Pagada" cuyo pagado registrado sea menor a su total, para que no se repita por otra carga legacy.

## Detalles técnicos

- `src/lib/financial/saldoFactura.ts`: `calcularSaldoFactura` recibe el estado de la factura y devuelve `saldo = 0` para `Pagada | Cancelada | Sustituida | Borrador` (conservando `pagado` y `notasCredito` reales para el desglose). Se actualizan los llamadores: `estadoCuentaTypes.mapFacturaEstadoCuenta`, y cualquier otro consumidor detectado por búsqueda.
- `estadoCuentaAggregates.calcularKpisEstadoCuenta`: sin cambio de fórmula — al venir `saldo = 0` deja de sumar. Se agregan tests de la nueva regla.
- Migración: `public.estado_cuenta_agregados` usa `CASE WHEN f.estado = 'Pagada' THEN 0 ELSE GREATEST(0, total − pagos − NC) END`. Se revisa igualmente `public.saldo_factura` para incluir `Pagada` en la lista de estados de saldo 0.
- Datos (operación aparte de la migración): `INSERT INTO public.pagos_factura` para las 31 facturas afectadas con `monto = monto_aplicado_factura = total`, `moneda`/`tipo_cambio` de la factura, `fecha_pago = fecha_emision`, `forma_pago = 'Transferencia'`, `estado_rep = 'NoAplica'`, `referencia = 'AJUSTE-LEGACY'`, `notas` explicativa y `organization_id` de la factura. Se ejecuta con un `WHERE NOT EXISTS` para ser idempotente.
- Guardrail SQL en `supabase/tests/` que consulte facturas `Pagada` con `pagado < total − 0.01` y falle si hay resultados.
- `CHANGELOG.md` + bump de `APP_VERSION`.

## Fuera de alcance

- No se toca la lógica de Cobranza (`cartera_pendiente`), que ya excluye facturas pagadas.
- No se generan REP ni movimientos bancarios para los pagos de ajuste.
