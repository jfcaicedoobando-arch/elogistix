/**
 * Helpers puros del panel `TarifaVinculadaPanel`. Aislados en un archivo
 * propio para cumplir con react-refresh/only-export-components.
 */
import type { TopTarifaRow } from "@/features/costeo/types";

type TipoContenedorItem = { id: string; name: string };

const normalizarNombreContenedor = (s: string) =>
  s.toLowerCase().replace(/['"'`]/g, "").replace(/\s+/g, " ").trim();

export function resolveTipoContenedorId(
  tipoContenedorActual: string | undefined,
  tiposContenedor: TipoContenedorItem[],
): string | undefined {
  if (!tipoContenedorActual) return undefined;
  if (tiposContenedor.some((t) => t.id === tipoContenedorActual)) return tipoContenedorActual;
  const objetivo = normalizarNombreContenedor(tipoContenedorActual);
  return tiposContenedor.find((t) => normalizarNombreContenedor(t.name) === objetivo)?.id;
}

export interface TarifaWarnings {
  vencidaAntesDeValidez: boolean;
  tipoMismatch: boolean;
}

export function computeTarifaWarnings(
  tarifa: Pick<TopTarifaRow, "vigente_hasta" | "tipo_contenedor_id"> | null | undefined,
  validez: Date | null | undefined,
  tipoContenedorActual: string | undefined,
): TarifaWarnings {
  // EC-06: `vigente_hasta` es date-only ("YYYY-MM-DD"); `new Date(str)` lo
  // parsea como medianoche UTC (= día anterior 18:00 en CDMX). Mismo patrón
  // que `aplicarTarifa.ts` (fin de día LOCAL) para no adelantar el aviso.
  let tarifaHasta: Date | null = null;
  if (tarifa?.vigente_hasta) {
    const [y, m, d] = tarifa.vigente_hasta.split("-").map(Number);
    if (y && m && d) tarifaHasta = new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  return {
    vencidaAntesDeValidez: !!tarifaHasta && !!validez && tarifaHasta < validez,
    tipoMismatch:
      !!tarifa && !!tipoContenedorActual && tipoContenedorActual !== tarifa.tipo_contenedor_id,
  };
}
