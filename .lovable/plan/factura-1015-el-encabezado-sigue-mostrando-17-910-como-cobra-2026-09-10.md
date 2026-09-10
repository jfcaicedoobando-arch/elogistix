# Factura 1015: el encabezado sigue mostrando 17,910 como cobrado

## Qué está pasando

El pago de la 1015 tiene su comprobante (REP) cancelado y en la tabla de pagos ya se ve tachado como "Anulado", pero el cálculo del cobrado y del saldo que alimenta el encabezado **sí lo sigue sumando**. Al quedar cobrado = total y saldo = 0, la pantalla concluye que la factura está liquidada y por eso bloquea la emisión de notas de crédito.

Ya se corrigió la parte de la base (el estado de la factura pasó a Vencida), pero el cálculo que corre en la pantalla es otro y todavía no distingue pagos anulados.

## Cambio propuesto (mínimo)

1. En el cálculo central de saldo (`src/lib/financial/saldoFactura.ts`), ignorar los pagos cuyo comprobante quedó cancelado, igual que ya lo hace la base con `saldo_factura_bruto`. Con eso:
   - el encabezado muestra cobrado 0 y saldo 17,910 USD;
   - la sección de pagos y el diálogo de registrar pago quedan consistentes;
   - la sección de notas de crédito se desbloquea sola (usa ese mismo saldo).
2. Incluir el estado del comprobante en la lectura del estado de cuenta del cliente, que hoy no lo pide y por lo tanto también infla lo cobrado en cartera y en el portal.
3. No se toca la tabla de pagos (el pago sigue visible como antecedente fiscal), ni importes, IVA, REPs, comisiones ni movimientos bancarios.

## Detalles técnicos

- `calcularSaldoFactura`: agregar `estado_rep?: string | null` a `PagoAplicadoLike` y filtrar `estado_rep === "Cancelado"` antes de sumar `monto_aplicado_factura`. Se conserva el atajo de estados terminales (`Pagada`, `Cancelada`, `Sustituida`).
- Consumidores que ya traen `estado_rep` y se benefician sin cambios: `useFacturaDetalleController`, `FacturaPagosSection`, `DialogRegistrarPago` (usan `listarPagosFactura` con `select("*")`).
- `estadoCuenta.ts`: añadir `estado_rep` al embed de `pagos_factura`; `estadoCuentaTypes.ts` lo pasa al canon.
- Pruebas focalizadas nuevas en `src/lib/financial/__tests__` (o el archivo existente de saldo) y en el portal: pago anulado no suma, pago mixto anulado + vigente suma sólo el vigente, compatibilidad cuando no viene `estado_rep`.

## Validación local

Typecheck, ESLint focalizado, pruebas focalizadas de facturación/portal, `audit:manifest` y build. CI, RLS y E2E completos quedan para GitHub Actions. Se sube `APP_VERSION` y se registra en `CHANGELOG.md`.
