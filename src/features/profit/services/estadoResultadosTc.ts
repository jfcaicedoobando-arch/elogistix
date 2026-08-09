/**
 * Respaldos de tipo de cambio para el EERR devengado (Ola 5 · A21/A22).
 * Las filas sin embarque vinculado no tienen TC propio: antes se valuaban a
 * 1 MXN por divisa, lo que subestimaba ingresos y costos en USD/EUR. Ahora se
 * usa el TC del DOF (`fetchExchangeRates`) con el fallback operativo
 * compartido `EXCHANGE_RATES_FALLBACK` como último recurso.
 */
import { fetchExchangeRates, EXCHANGE_RATES_FALLBACK } from "@/features/catalogos/services";

export interface TcFallback { usd: number; eur: number }

/** Devuelve `tc` si es positivo; si no, el respaldo indicado. */
export const fallbackTC = (tc: number | null, respaldo: number) => (tc && tc > 0 ? tc : respaldo);

export async function tcFallbackDof(): Promise<TcFallback> {
  const rates = await fetchExchangeRates().catch(() => EXCHANGE_RATES_FALLBACK);
  return {
    usd: rates.usdMxn > 0 ? rates.usdMxn : EXCHANGE_RATES_FALLBACK.usdMxn,
    eur: rates.eurMxn > 0 ? rates.eurMxn : EXCHANGE_RATES_FALLBACK.eurMxn,
  };
}
