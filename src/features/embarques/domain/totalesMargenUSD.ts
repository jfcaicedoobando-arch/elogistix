/**
 * Totales de venta y costo del embarque en USD para la regla de margen mínimo.
 * Usa la MISMA conversión que el paso «Costos y Pricing» (`sumarEnMoneda` a USD)
 * para que el margen evaluado al guardar coincida con el que ve el usuario.
 * Devuelve `null` cuando hay monedas mezcladas sin tipo de cambio confiable:
 * sin conversión no se puede comparar pesos con dólares.
 */
import { sumarEnMoneda } from "@/lib/financial/costosUSD";
import { subtotalVentaLinea } from "@/features/embarques/domain/subtotalVentaLinea";

export interface TotalesMargenUSD {
  ventaUSD: number;
  costoUSD: number;
}

interface VentaLinea { cantidad?: number; precioUnitario: number; moneda: string }
interface CostoLinea { monto: number; moneda: string }

function tcCapturado(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseFloat(String(raw ?? ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function totalesMargenUSD(
  ventas: VentaLinea[],
  costos: CostoLinea[],
  tcUSDRaw: unknown,
  tcEURRaw: unknown,
): TotalesMargenUSD | null {
  const tcUSD = tcCapturado(tcUSDRaw);
  const tcEUR = tcCapturado(tcEURRaw);
  try {
    const ventaUSD = sumarEnMoneda(
      ventas.map((v) => ({ monto: subtotalVentaLinea(v.cantidad, v.precioUnitario), moneda: v.moneda })),
      "USD", tcUSD, tcEUR,
    ).total;
    const costoUSD = sumarEnMoneda(
      costos.map((c) => ({ monto: c.monto, moneda: c.moneda })),
      "USD", tcUSD, tcEUR,
    ).total;
    return { ventaUSD, costoUSD };
  } catch {
    return null;
  }
}
