/**
 * Helpers de filtrado para las consultas de `crm_oportunidades`.
 * Extraído de `oportunidades.ts` (Power of 10 — límite de líneas por archivo).
 */
import { orIlike } from "@/lib/search/ilike";

export interface FiltrosOportunidades {
  search: string;
  etapaId: string | "todas";
  vendedorId: string | "todos";
  /**
   * v13.823.49 — antes el rango de cierre y el monto mínimo se filtraban en
   * memoria sobre las primeras 500 filas, así que el listado (y la exportación)
   * omitían coincidencias posteriores.
   */
  cierreDesde?: string;
  cierreHasta?: string;
  montoMin?: number | null;
  /** Filtro directo por cliente, usado desde Cliente 360 ("Ver todas"). */
  clienteId?: string | null;
}

/** Aplica los filtros de negocio a un builder de `crm_oportunidades`. */
export function aplicarFiltrosOportunidades<T extends {
  or: (f: string) => T; eq: (c: string, v: string) => T;
  gte: (c: string, v: string | number) => T; lte: (c: string, v: string | number) => T;
  not: (c: string, op: string, v: null) => T;
}>(q: T, p: FiltrosOportunidades): T {
  let out = q;
  if (p.search.trim()) out = out.or(orIlike(["nombre", "cliente_nombre"], p.search));
  if (p.clienteId) out = out.eq("cliente_id", p.clienteId);
  if (p.etapaId !== "todas") out = out.eq("etapa_id", p.etapaId);
  if (p.vendedorId !== "todos") out = out.eq("vendedor_id", p.vendedorId);
  if (p.cierreDesde) {
    out = out.not("fecha_estimada_cierre", "is", null).gte("fecha_estimada_cierre", p.cierreDesde);
  }
  if (p.cierreHasta) {
    out = out.not("fecha_estimada_cierre", "is", null).lte("fecha_estimada_cierre", p.cierreHasta);
  }
  if (typeof p.montoMin === "number" && Number.isFinite(p.montoMin)) {
    out = out.gte("monto_estimado", p.montoMin);
  }
  return out;
}
