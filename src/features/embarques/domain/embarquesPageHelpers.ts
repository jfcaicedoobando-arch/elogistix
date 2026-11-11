export interface EmbarqueListExtras {
  liquidacion: Record<string, { total: number; pagados: number }>;
  docs: Record<string, { total: number; pendientes: number }>;
}

export type SortDir = "asc" | "desc";

/** Extrae el consecutivo numérico del expediente ignorando el prefijo. */
export function expedienteConsecutivo(expediente: string | null | undefined): number {
  return Number(expediente?.replace(/\D/g, "") || 0);
}

export function buildEmbarquesDescription(expedientesCount: number, estadoActivo: boolean): string {
  if (!estadoActivo) {
    return `${expedientesCount} ${expedientesCount === 1 ? "embarque" : "embarques"}`;
  }
  return `${expedientesCount} ${expedientesCount === 1 ? "expediente" : "expedientes"}`;
}

interface SinFiltrosArgs {
  debouncedSearch: string;
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  filterAlerta: string;
  fechaDesde: string;
  fechaHasta: string;
}

export function computeSinFiltros(a: SinFiltrosArgs): boolean {
  return (
    !a.debouncedSearch &&
    [a.filterModo, a.filterEstado, a.filterCliente, a.filterOperador, a.filterAlerta].every((v) => v === "todos") &&
    !a.fechaDesde &&
    !a.fechaHasta
  );
}
