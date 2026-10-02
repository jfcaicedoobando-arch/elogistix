/**
 * Tarifas vigentes y aprobadas del catálogo de Costeo para llenar una opción
 * de Pricing. Sólo se copian datos: la opción no cambia si la tarifa cambia.
 */
import { supabase } from "@/integrations/supabase/client";
import { hoyMx } from "@/lib/date/mx";
import type { OpcionPricingForm } from "./tiposPricing";

export interface TarifaParaPricing {
  id: string;
  naviera_id: string | null;
  moneda: string;
  flete_base: number;
  transit_time_dias: number | null;
  agente: string | null;
  naviera: string | null;
}

export async function listarTarifasParaPricing(): Promise<TarifaParaPricing[]> {
  const hoy = hoyMx();
  const { data, error } = await supabase
    .from("costeo_tarifas")
    .select("id, naviera_id, moneda, flete_base, transit_time_dias, costeo_agentes(nombre), navieras(name)")
    .eq("estado_aprobacion", "aprobada")
    .lte("vigente_desde", hoy)
    .gte("vigente_hasta", hoy)
    .order("flete_base", { ascending: true })
    .limit(100);
  if (error) throw error;
  // SAFE-CAST: select explícito con joins uno-a-uno.
  const filas = (data ?? []) as unknown as Array<{
    id: string; naviera_id: string | null; moneda: string; flete_base: number; transit_time_dias: number | null;
    costeo_agentes: { nombre: string } | null; navieras: { name: string } | null;
  }>;
  return filas.map((t) => ({
    id: t.id, naviera_id: t.naviera_id, moneda: t.moneda, flete_base: Number(t.flete_base),
    transit_time_dias: t.transit_time_dias, agente: t.costeo_agentes?.nombre ?? null, naviera: t.navieras?.name ?? null,
  }));
}

/** Copia la tarifa a la opción conservando lo ya capturado en los otros cargos. */
export function opcionDesdeTarifa(actual: OpcionPricingForm, t: TarifaParaPricing): OpcionPricingForm {
  const moneda = t.moneda === "MXN" || t.moneda === "EUR" ? t.moneda : "USD";
  return {
    ...actual,
    tarifa_id: t.id,
    agente: t.agente ?? actual.agente,
    naviera_id: t.naviera_id ?? actual.naviera_id,
    transito: t.transit_time_dias != null ? `${t.transit_time_dias} días` : actual.transito,
    of_tarifa: t.flete_base,
    of_moneda: moneda,
    of_unidad: actual.of_unidad || "Contenedor",
  };
}

export function etiquetaTarifa(t: TarifaParaPricing): string {
  const partes = [t.naviera ?? "Sin naviera", t.agente, `${t.moneda} ${t.flete_base.toLocaleString("es-MX")}`];
  if (t.transit_time_dias != null) partes.push(`${t.transit_time_dias} d`);
  return partes.filter(Boolean).join(" · ");
}
