import type { TarifaInput } from "@/features/costeo/services/tarifas";

export const usdFormatter = new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD" });
export const usd = (n: number) => usdFormatter.format(n);

export type EstadoFiltro = "vigente" | "vencida" | "reemplazada" | "todas";
export type AprobacionFiltro = "todas" | "borrador" | "vigente" | "rechazada";

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
