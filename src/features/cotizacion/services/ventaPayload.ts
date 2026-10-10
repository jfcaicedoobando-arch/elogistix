/** Paso 3 y finalización comparten importes/moneda/TC sin transformar renglones. */
import { tcValido } from "@/lib/financial/tcValido";
import { derivarSubtotalMoneda } from "./derivarSubtotalMoneda";
export interface VentaCotizacionPayloadInput {
  conceptosVenta: Record<string, unknown>[];
  monedaFallback?: string | null;
  tipoCambioUsd?: number | null;
  /** El origen Pricing confirmado fija la moneda de cabecera. */
  conservarMoneda?: boolean;
}
export function buildVentaCotizacionPayload({ conceptosVenta, monedaFallback, tipoCambioUsd, conservarMoneda = false }: VentaCotizacionPayloadInput): Record<string, unknown> {
  const { subtotal, moneda } = derivarSubtotalMoneda(conceptosVenta, monedaFallback, tipoCambioUsd, conservarMoneda);
  const data: Record<string, unknown> = { conceptos_venta: conceptosVenta, subtotal, moneda };
  if (tipoCambioUsd !== undefined) data.tipo_cambio_usd = tcValido(tipoCambioUsd);
  return data;
}
