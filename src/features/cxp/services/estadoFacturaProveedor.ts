/** CxP: la tolerancia absorbe remanentes después de cobertura financiera real. */
export const SALDO_TOLERANCIA_MXN = 0.01;
export type EstadoFacturaProveedor = "Pagada" | "Vigente" | "Cancelada" | "Borrador";

/** Cobertura neta en moneda documental: pagos vivos (incluidos anticipos/ajustes)
 * más NC aplicadas vivas. Una deuda íntegra positiva nunca es redondeo. */
export function saldoProveedorLiquidado(saldo: number, cobertura: number): boolean {
  if (!Number.isFinite(saldo) || !Number.isFinite(cobertura)) return false;
  return saldo <= 0 || (saldo <= SALDO_TOLERANCIA_MXN && cobertura > 0);
}

/** Recalcular explícitamente permite reabrir tras reversar la última aplicación. */
export function decidirEstadoFactura(
  estadoActual: EstadoFacturaProveedor,
  saldo: number,
  cobertura = 0,
): EstadoFacturaProveedor {
  if (estadoActual === "Cancelada" || estadoActual === "Borrador") return estadoActual;
  if (!Number.isFinite(saldo) || !Number.isFinite(cobertura)) return estadoActual;
  return saldoProveedorLiquidado(saldo, cobertura) ? "Pagada" : "Vigente";
}
