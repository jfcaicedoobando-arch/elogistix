import { montoProveedorEnMonedaFactura } from "./montoProveedorEnMonedaFactura";

export interface ContextoFacturaNotaCredito {
  moneda: string;
  tipo_cambio_usd: number | null;
}

/** Presentación con tasas guardadas; nunca sustituye un TC histórico faltante. */
export function equivalenteNotaCredito(
  nota: { monto: number; moneda: string; tipo_cambio: number | null },
  factura: ContextoFacturaNotaCredito | null | undefined,
): number | null {
  if (!factura) return null;
  return montoProveedorEnMonedaFactura(nota.monto, nota.moneda, nota.tipo_cambio, factura.moneda);
}
