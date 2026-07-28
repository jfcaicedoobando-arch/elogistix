import type { TarifaInput } from "@/features/costeo/services/tarifas";
import { formatUSD } from "@/lib/formatters";
import { diasHastaFecha } from "@/lib/date/dateOnly";

/** Re-export para call-sites históricos (`usd(n)`). Delega en el canónico `formatUSD`. */
export const usd = formatUSD;

export type EstadoFiltro = "vigente" | "vencida" | "reemplazada" | "todas";
export type AprobacionFiltro = "todas" | "borrador" | "vigente" | "rechazada";

const mesesCortos = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export function formatVigencia(desde: string, hasta: string): string {
  const fmt = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    return `${String(d).padStart(2, "0")}/${mesesCortos[m - 1]}`;
  };
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
      concepto: r.concepto,
      lado: (r.lado === "origen" || r.lado === "destino") ? r.lado : undefined,
      monto: Number(r.monto),
      moneda: r.moneda ?? "USD",
      incluido_en_total: r.incluido_en_total ?? true,
    })),
  };
}
