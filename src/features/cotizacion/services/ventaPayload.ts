/** Paso 3 y finalización comparten importes/moneda/TC sin transformar renglones. */
import { tcValido } from "@/lib/financial/tcValido";
import { derivarSubtotalMoneda } from "./derivarSubtotalMoneda";
import { ReglaNegocioError } from "@/lib/errors/reglaNegocio";
export interface VentaCotizacionPayloadInput {
  conceptosVenta: Record<string, unknown>[];
  monedaFallback?: string | null;
  tipoCambioUsd?: number | null;
  /** El origen Pricing confirmado fija la moneda de cabecera. */
  conservarMoneda?: boolean;
  monedaTarifa?: string | null;
}
export function buildVentaCotizacionPayload({ conceptosVenta, monedaFallback, tipoCambioUsd, conservarMoneda = false, monedaTarifa }: VentaCotizacionPayloadInput): Record<string, unknown> {
  if (monedaTarifa === "MXN" && !tcValido(tipoCambioUsd)) {
    throw new ReglaNegocioError("Captura el tipo de cambio DOF de hoy en el paso 3 para la tarifa en MXN.");
  }
  const tarifaElegida = monedaTarifa === "USD" || monedaTarifa === "MXN";
  const { subtotal, moneda } = derivarSubtotalMoneda(conceptosVenta, tarifaElegida ? monedaTarifa : monedaFallback, tipoCambioUsd, tarifaElegida || conservarMoneda);
  const data: Record<string, unknown> = { conceptos_venta: conceptosVenta, subtotal, moneda };
  if (tipoCambioUsd !== undefined) data.tipo_cambio_usd = tcValido(tipoCambioUsd);
  return data;
}
