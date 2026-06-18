/**
 * Calcula etiquetas comparativas ("Mejor precio", "Más crédito", "Más días libres")
 * y deltas vs el ganador (#1) para un set de Top tarifas.
 */
import type { TopTarifaRow } from "@/features/costeo/types";

export interface RankingMeta {
  esGanador: boolean;
  etiquetasMejorEn: string[]; // ej. ["Mejor precio", "Más crédito"]
  deltaTotalVsGanador: number; // 0 para el ganador, positivo para el resto (USD)
  vencePronto: boolean; // vigente_hasta dentro de 7 días
}

const MS_DIA = 86_400_000;

function diasHasta(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(String(iso).split("T")[0]).getTime();
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / MS_DIA);
}

export function computeRankingMeta(rows: ReadonlyArray<TopTarifaRow>): RankingMeta[] {
  if (!rows.length) return [];
  const ganadorTotal = rows[0]?.total_comparable ?? 0;

  const minTotal = Math.min(...rows.map((r) => Number(r.total_comparable || 0)));
  const maxCredito = Math.max(...rows.map((r) => Number(r.dias_credito || 0)));
  const maxLibres = Math.max(...rows.map((r) => Number(r.dias_libres_demoras || 0)));
  const minTransito = Math.min(
    ...rows.map((r) => (r.transit_time_dias == null ? Infinity : Number(r.transit_time_dias))),
  );

  return rows.map((r, i) => {
    const etiquetas: string[] = [];
    if (Number(r.total_comparable || 0) === minTotal) etiquetas.push("Mejor precio");
    if (Number(r.dias_credito || 0) === maxCredito && maxCredito > 0) etiquetas.push("Más crédito");
    if (Number(r.dias_libres_demoras || 0) === maxLibres && maxLibres > 0) etiquetas.push("Más días libres");
    if (
      r.transit_time_dias != null &&
      Number(r.transit_time_dias) === minTransito &&
      minTransito !== Infinity
    ) {
      etiquetas.push("Tránsito más corto");
    }

    const dias = diasHasta(r.vigente_hasta);
    const vencePronto = dias != null && dias >= 0 && dias <= 7;

    return {
      esGanador: i === 0,
      etiquetasMejorEn: etiquetas,
      deltaTotalVsGanador: Number(r.total_comparable || 0) - ganadorTotal,
      vencePronto,
    };
  });
}
