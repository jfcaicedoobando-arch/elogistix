/**
 * Vistas guardadas del pipeline (estilo Salesforce "list views").
 *
 * Módulo puro: cada vista devuelve un set de `OportunidadesFiltros` listo
 * para aplicar sobre el dataset ya cargado. Sin React ni Supabase.
 */
import { format, startOfMonth, endOfMonth } from "date-fns";
import {
  FILTROS_DEFAULT,
  type OportunidadesFiltros,
} from "@/features/crm/components/oportunidadesFiltersTypes";

export type VistaGuardadaId = "todas" | "mis-deals" | "cierra-mes" | "alto-valor";

export interface VistaGuardadaCtx {
  /** Usuario actual (para "Mis deals"). */
  userId?: string | null;
  /** Fecha de referencia; inyectable para tests. */
  hoy?: Date;
  /** Umbral de "alto valor" en la moneda base. */
  umbralAltoValor?: number;
}

export interface VistaGuardada {
  id: VistaGuardadaId;
  label: string;
  /** `false` cuando falta contexto (p. ej. no hay usuario para "Mis deals"). */
  disponible: boolean;
  filtros: OportunidadesFiltros;
}

const UMBRAL_ALTO_VALOR_DEFAULT = 50_000;

export function buildVistasGuardadas(ctx: VistaGuardadaCtx = {}): VistaGuardada[] {
  const hoy = ctx.hoy ?? new Date();
  const umbral = ctx.umbralAltoValor ?? UMBRAL_ALTO_VALOR_DEFAULT;
  return [
    { id: "todas", label: "Todas", disponible: true, filtros: FILTROS_DEFAULT },
    {
      id: "mis-deals",
      label: "Mis deals",
      disponible: Boolean(ctx.userId),
      filtros: { ...FILTROS_DEFAULT, vendedorId: ctx.userId ?? "todos" },
    },
    {
      id: "cierra-mes",
      label: "Cierra este mes",
      disponible: true,
      filtros: {
        ...FILTROS_DEFAULT,
        cierreDesde: format(startOfMonth(hoy), "yyyy-MM-dd"),
        cierreHasta: format(endOfMonth(hoy), "yyyy-MM-dd"),
      },
    },
    {
      id: "alto-valor",
      label: "Alto valor",
      disponible: true,
      filtros: { ...FILTROS_DEFAULT, montoMin: String(umbral) },
    },
  ];
}

/** Devuelve el id de la vista cuyos filtros coinciden exactamente, o `null`. */
export function detectarVistaActiva(
  filtros: OportunidadesFiltros,
  vistas: VistaGuardada[],
): VistaGuardadaId | null {
  const match = vistas.find(
    (v) =>
      v.disponible &&
      v.filtros.etapaId === filtros.etapaId &&
      v.filtros.vendedorId === filtros.vendedorId &&
      v.filtros.cierreDesde === filtros.cierreDesde &&
      v.filtros.cierreHasta === filtros.cierreHasta &&
      v.filtros.montoMin === filtros.montoMin,
  );
  return match?.id ?? null;
}
