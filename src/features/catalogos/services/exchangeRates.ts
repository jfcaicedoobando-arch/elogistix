/**
 * Tipo de cambio DOF vía edge `exchange-rates` (extraído de `./index.ts` para
 * cumplir el límite de 200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import { reportCaughtError } from "@/lib/observability/reportCaughtError";
import type { ExchangeRates } from "./catalogosTypes";

/**
 * Fallback operativo (NO fiscal) cuando la edge `exchange-rates` no responde.
 * Fuente única: cualquier consumidor debe importar esta constante en vez de
 * volver a codificar 17.25/18.5 (Ola 5 · A21).
 */
export const EXCHANGE_RATES_FALLBACK: ExchangeRates = { usdMxn: 17.25, eurMxn: 18.5, esFallback: true };

/**
 * @param fecha ISO `YYYY-MM-DD` opcional. Si se provee y es anterior a hoy,
 *   la edge devuelve la Publicación DOF vigente **ese** día (útil para
 *   valuar facturas de proveedor emitidas en el pasado). Sin fecha, o con
 *   fecha ≥ hoy, se comporta como antes (DOF de hoy).
 */
export async function fetchExchangeRates(fecha?: string): Promise<ExchangeRates> {
  const body = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? { fecha } : undefined;
  const { data, error } = await supabase.functions.invoke("exchange-rates", body ? { body } : {});
  if (error) {
    // `FunctionsFetchError` = el navegador no logró siquiera contactar la edge
    // (cold start, micro-corte de red, AdBlock). Es transitorio y la app tiene
    // fallback. Sólo dejamos breadcrumb, NO reportamos, y devolvemos los rates
    // fallback para evitar reintentos inútiles de React Query.
    const isFetchError =
      (error as { name?: string })?.name === "FunctionsFetchError";
    if (isFetchError) {
      void import("@sentry/react").then((Sentry) => {
        Sentry.addBreadcrumb({
          category: "exchange_rates",
          level: "warning",
          message: "exchange_rates.fetch_error.fallback",
          data: { name: (error as { name?: string })?.name },
        });
      }).catch(() => undefined);
      return EXCHANGE_RATES_FALLBACK;
    }
    // Errores no transitorios (5xx, JSON inválido) sí van a Sentry vía
    // `reportCaughtError` (13.320.22 · Tanda 1 · S1: reemplaza captura directa
    // para heredar tags de tenant/route/version).
    reportCaughtError(error, { feature: "exchange_rates", op: "edge_invoke" });
    throw error;
  }
  return mapExchangeRates(data);
}

/**
 * Normaliza la respuesta 200 de la edge `exchange-rates` al contrato camelCase.
 * FIX-10: la edge usa snake_case (`es_fallback`).
 * RG18 (Ola 3): si el cuerpo viene sin `usdMxn`, estamos mostrando el fallback
 * aunque la edge no lo haya marcado; hay que declararlo.
 * EF-04: igual para el EUR (`eur_es_fallback` o `eurMxn: null`) — en ambos casos
 * el valor mostrado (18.5) es estimado, no un TC real.
 */
function mapExchangeRates(data: Record<string, unknown> | null | undefined): ExchangeRates {
  const usd = (data?.usdMxn ?? null) as number | null;
  const eur = (data?.eurMxn ?? null) as number | null;
  return {
    usdMxn: usd ?? EXCHANGE_RATES_FALLBACK.usdMxn,
    eurMxn: eur ?? EXCHANGE_RATES_FALLBACK.eurMxn,
    fechaAplicada: data?.fechaAplicada as string | undefined,
    esFallback: data?.es_fallback === true || usd == null,
    eurEsFallback: data?.eur_es_fallback === true || eur == null,
  };
}



