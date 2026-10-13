import type { KPIsEjecutivos } from "../services/types";
import type { ResumenVsReal } from "@/features/presupuesto/services";
import { formatPercent } from "@/lib/formatters/numbers";

/**
 * Deriva variant + texto para la KPI "Cumplim. presupuesto". Extraído del
 * componente para bajar la complejidad ciclomática (regla ESLint ≤16).
 */
function buildCumplimientoDisplay(
  cumplimiento: number,
  excesos: number,
  tienePresupuesto: boolean,
): { variant: "positive" | "negative" | "neutral"; delta: string; sinPresupuesto: boolean } {
  const sinPresupuesto = !tienePresupuesto;
  if (sinPresupuesto) return { variant: "neutral", delta: "Sin presupuesto capturado", sinPresupuesto };
  if (excesos > 0) return { variant: "negative", delta: `${excesos} categoría(s) en exceso`, sinPresupuesto };
  if (cumplimiento > 100) return { variant: "neutral", delta: "Cercano al límite", sinPresupuesto };
  return { variant: "positive", delta: "En rango", sinPresupuesto };
}

export function cumplimientoDisplay(kpis: KPIsEjecutivos, presupuesto?: ResumenVsReal) {
  const tiene = kpis.tiene_presupuesto ?? (presupuesto ? presupuesto.total_presupuesto_mxn > 0 : kpis.cumplimiento_presupuesto_pct > 0);
  const display = buildCumplimientoDisplay(kpis.cumplimiento_presupuesto_pct, kpis.categorias_en_exceso ?? 0, tiene);
  if (kpis.presupuesto_incompleto) return { value: "No disponible", delta: "Gasto real incompleto", variant: "neutral" as const };
  return { value: display.sinPresupuesto ? "—" : formatPercent(kpis.cumplimiento_presupuesto_pct, 1), delta: display.delta, variant: display.variant };
}

export function puedeVerExcesos(kpis: KPIsEjecutivos, presupuesto?: ResumenVsReal): boolean {
  return !!presupuesto && kpis.categorias_en_exceso > 0 && !kpis.presupuesto_incompleto;
}
