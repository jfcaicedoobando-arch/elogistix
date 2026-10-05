import { diasVencidos } from "@/lib/date/dateOnly";
import { CUBETA_LABELS_LARGAS, type CubetaAging } from "./buckets";

export interface AgingTableFilters {
  search?: string;
  cubeta?: string;
}

export const AGING_EXPORT_ALCANCE = "Todas las filas filtradas (sin paginación)";

/** Traduce el filtro de las tablas a la cubeta canónica del detalle. */
export function cubetaDesdeFiltro(filtro = "todas"): CubetaAging | "todas" {
  switch (filtro) {
    case "vigente": return "vigente";
    case "1_30": return "d_1_30";
    case "31_60": return "d_31_60";
    case "61_90": return "d_61_90";
    case "mas_90": return "mas_90";
    default: return "todas";
  }
}

export function describirFiltrosAging({ search, cubeta }: AgingTableFilters = {}): string {
  const bucket = cubetaDesdeFiltro(cubeta);
  const filters = [bucket === "todas" ? "Todas las cubetas" : `Con saldo en ${CUBETA_LABELS_LARGAS[bucket]}`];
  if (search) filters.push(`Búsqueda: ${search}`);
  return filters.join("; ");
}

/** Mismo cálculo date-only y fallback de vencimiento que las RPC de Aging. */
export function clasificarAFecha<T extends {
  fecha_vencimiento: string | null;
  fecha_emision: string;
  dias_vencido: number;
}>(facturas: readonly T[], fechaReferencia: string): T[] {
  return facturas.map((f) => ({
    ...f,
    dias_vencido: diasVencidos(f.fecha_vencimiento || f.fecha_emision, fechaReferencia),
  }));
}

export function csvTexto(texto: string): string {
  return `"${texto.replace(/"/g, '""')}"`;
}
