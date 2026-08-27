/**
 * Filtros puros y KPIs del listado de Cotizaciones.
 *
 * Extraído de `useCotizacionesPageController.ts` para respetar el límite de
 * 200 líneas (Power of 10).
 */
import { useMemo } from "react";
import { ESTADOS_INACTIVOS } from "@/features/cotizacion/domain/lifecycle";
import type { useCotizaciones } from "@/features/cotizacion/hooks/useCotizaciones";

export type CotizacionListItem = NonNullable<ReturnType<typeof useCotizaciones>["data"]>[number];

// ── Pure filter helpers ──────────────────────────────────────────────────────

export function matchesSearch(c: CotizacionListItem, search: string): boolean {
  // EC-7: `folio`, `cliente_nombre` y `descripcion_mercancia` pueden llegar
  // NULL desde la BD (cotizaciones legacy o borradores sin mercancía); antes
  // el listado crasheaba con "Cannot read properties of null".
  if (!search) return true;
  const q = search.toLowerCase();
  const campos = [c.folio, c.cliente_nombre, c.descripcion_mercancia];
  return campos.some((campo) => (campo ?? "").toLowerCase().includes(q));
}

export function esCotizacionInactivaOculta(
  c: CotizacionListItem,
  incluirInactivas: boolean,
  filterEstado: string,
): boolean {
  const esInactiva = (ESTADOS_INACTIVOS as readonly string[]).includes(c.estado ?? "");
  if (!esInactiva) return false;
  if (incluirInactivas) return false;
  if (filterEstado !== "todos" && filterEstado === c.estado) return false;
  return true;
}

/** Segmento comercial: separa la prospección (CRM) de la operación con clientes. */
export type SegmentoCotizacion = "clientes" | "prospectos" | "todas";

export function matchesSegmento(c: CotizacionListItem, segmento: SegmentoCotizacion): boolean {
  if (segmento === "todas") return true;
  const esProspecto = c.es_prospecto === true;
  return segmento === "prospectos" ? esProspecto : !esProspecto;
}

export interface CotizacionFilterParams {
  search: string;
  filterEstado: string;
  filterCliente: string;
  filterSinCostos: boolean;
  incluirInactivas: boolean;
  /** O4.5(a): bandeja "Aceptadas sin embarque" (estado Aceptada y sin embarque_id). */
  soloAceptadasSinEmbarque: boolean;
  segmento: SegmentoCotizacion;
}

/** O4.5(a): la cotización quedó aceptada pero nadie abrió el embarque. */
export function esAceptadaSinEmbarque(c: CotizacionListItem): boolean {
  return c.estado === "Aceptada" && !c.embarque_id;
}

export function matchesCotizacionFilter(
  c: CotizacionListItem,
  p: CotizacionFilterParams,
): boolean {
  if (!matchesSegmento(c, p.segmento)) return false;
  if (!matchesSearch(c, p.search)) return false;
  if (p.filterEstado !== "todos" && c.estado !== p.filterEstado) return false;
  if (p.filterCliente !== "todos" && c.cliente_id !== p.filterCliente) return false;
  if (p.filterSinCostos && !(!!c.sin_desglose_costos && ((c.cotizacion_costos_count ?? 0) === 0))) return false;
  if (p.soloAceptadasSinEmbarque && !esAceptadaSinEmbarque(c)) return false;
  if (esCotizacionInactivaOculta(c, p.incluirInactivas, p.filterEstado)) return false;
  return true;
}

/** KPIs derivados — siempre últimos 30 días, ignoran filtros visibles (salvo el segmento). */
export function useCotizacionKpis(cotizaciones: CotizacionListItem[], segmento: SegmentoCotizacion) {
  return useMemo(() => {
    const hace30Dias = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ultimos30 = cotizaciones.filter((c) => {
      if (!matchesSegmento(c, segmento)) return false;
      if (!c.created_at) return false;
      const ts = new Date(c.created_at).getTime();
      return Number.isFinite(ts) && ts >= hace30Dias;
    });
    const total = ultimos30.length;
    const aceptadas = ultimos30.filter(
      (c) => c.estado === "Aceptada" || c.estado === "En operación",
    ).length;
    const rechazadas = ultimos30.filter((c) => c.estado === "Rechazada").length;
    const tasa = total > 0 ? ((aceptadas / total) * 100).toFixed(1) : "0.0";
    return { total, aceptadas, rechazadas, tasa };
  }, [cotizaciones, segmento]);
}

