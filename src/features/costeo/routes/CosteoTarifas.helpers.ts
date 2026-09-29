import type { TarifaInput } from "@/features/costeo/services/tarifas";
import type { CosteoTarifaRow } from "@/features/costeo/types";
import { textoBusquedaPuertos } from "@/features/costeo/utils/puertoLabel";
import {
  coincideBusqueda, esBorradorAprobable, esTarifaPorVencerEn, esTarifaProgramadaEn,
} from "@/features/costeo/utils/vigenciaTarifa";
import { formatUSD, formatFechaDia } from "@/lib/formatters";
import { diasHastaFecha } from "@/lib/date/dateOnly";

/** Re-export para call-sites históricos (`usd(n)`). Delega en el canónico `formatUSD`. */
export const usd = formatUSD;

export type EstadoFiltro = "vigente" | "vencida" | "reemplazada" | "todas";
export type AprobacionFiltro = "todas" | "borrador" | "vigente" | "programada" | "rechazada";

export interface TarifasCatalogoResultado {
  tarifasFiltradas: CosteoTarifaRow[];
  pendientesCount: number;
  programadasCount: number;
}

/** Selecciona el subconjunto visible y mantiene conteos del catálogo sin filtros locales. */
export function seleccionarTarifasCatalogo(
  tarifas: CosteoTarifaRow[],
  filtros: { aprobacion: AprobacionFiltro; busqueda: string; soloPorVencer: boolean },
  hoy: string,
): TarifasCatalogoResultado {
  const pendientesCount = tarifas.filter((t) => esBorradorAprobable(t, hoy)).length;
  const programadasCount = tarifas.filter((t) => esTarifaProgramadaEn(t, hoy)).length;
  const tarifasFiltradas = tarifas.filter((t) => {
    const pasaAprobacion = filtros.aprobacion === "programada"
      ? esTarifaProgramadaEn(t, hoy)
      : filtros.aprobacion === "todas" || (t.estado_aprobacion ?? "vigente") === filtros.aprobacion;
    if (!pasaAprobacion || (filtros.soloPorVencer && !esTarifaPorVencerEn(t, hoy))) return false;
    return coincideBusqueda(
      `${textoBusquedaPuertos(t)} ${t.agente_nombre} ${t.naviera_nombre}`,
      filtros.busqueda,
    );
  });
  return { tarifasFiltradas, pendientesCount, programadasCount };
}


/**
 * VB-38: vigencia en formato único DD/MM/YYYY (antes "18/jul → 15/dic" sin
 * año, mientras /costeo/rutas mostraba "15/12/2026" para el mismo dato).
 */
export function formatVigencia(desde: string, hasta: string): string {
  // ISO inválido → devolver el valor crudo (comportamiento previo).
  const fmt = (iso: string) => formatFechaDia(iso, iso);
  return `${fmt(desde)} → ${fmt(hasta)}`;
}

export function vigenciaHint(hasta: string): { text: string; tone: "muted" | "warn" | "danger" } {
  // B-089: `hasta` es date-only; contar días naturales en hora local.
  const diff = diasHastaFecha(hasta);
  if (diff < 0) return { text: `vencida hace ${Math.abs(diff)} d`, tone: "danger" };
  if (diff === 0) return { text: "vence hoy", tone: "danger" };
  if (diff <= 7) return { text: `vence en ${diff} d`, tone: "warn" };
  return { text: `vence en ${diff} d`, tone: "muted" };
}

type TarifaRow = {
  agente_id: string;
  naviera_id: string;
  ruta_id: string;
  tipo_contenedor_id: string;
  flete_base: number | string;
  dias_libres_demoras: number;
  vigente_desde: string;
  vigente_hasta: string;
  transit_time_dias: number | null;
  notas: string | null;
  recargos?: Array<{
    id?: string;
    concepto: string;
    lado: "origen" | "destino" | string | null;
    monto: number | string;
    moneda: string | null;
    incluido_en_total: boolean | null;
  }>;
};

export function buildInitialFromTarifa(t: TarifaRow): Partial<TarifaInput> {
  return {
    agente_id: t.agente_id,
    naviera_id: t.naviera_id,
    ruta_id: t.ruta_id,
    tipo_contenedor_id: t.tipo_contenedor_id,
    flete_base: Number(t.flete_base),
    dias_libres_demoras: t.dias_libres_demoras,
    vigente_desde: t.vigente_desde,
    vigente_hasta: t.vigente_hasta,
    transit_time_dias: t.transit_time_dias ?? 0,
    notas: t.notas,
    recargos: (t.recargos ?? []).map((r) => ({
      id: r.id,
      concepto: r.concepto,
      lado: (r.lado === "origen" || r.lado === "destino") ? r.lado : undefined,
      monto: Number(r.monto),
      moneda: r.moneda ?? "USD",
      incluido_en_total: r.incluido_en_total ?? true,
    })),
  };
}
