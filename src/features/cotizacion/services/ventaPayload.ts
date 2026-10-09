/** Paso 3 y finalización comparten importes/moneda/TC sin transformar renglones. */
import { derivarSubtotalMoneda } from "./derivarSubtotalMoneda";
export interface VentaCotizacionPayloadInput {
  conceptosVenta: Record<string, unknown>[];
  monedaFallback?: string | null;
  tipoCambioUsd?: number | null;
}
export function buildVentaCotizacionPayload({ conceptosVenta, monedaFallback, tipoCambioUsd }: VentaCotizacionPayloadInput): Record<string, unknown> {
  const { subtotal, moneda } = derivarSubtotalMoneda(conceptosVenta, monedaFallback, tipoCambioUsd);
  const data: Record<string, unknown> = { conceptos_venta: conceptosVenta, subtotal, moneda };
  if (tipoCambioUsd !== undefined) data.tipo_cambio_usd = Number(tipoCambioUsd) > 0 ? Number(tipoCambioUsd) : null;
  return data;
}
