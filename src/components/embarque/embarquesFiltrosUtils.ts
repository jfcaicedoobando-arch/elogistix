/**
 * Calcula el número de filtros activos para mostrarlos en el badge del botón "Filtros".
 * Excluye la búsqueda libre (tiene su propio input visible) y los valores "todos".
 *
 * Extraído de `EmbarquesFiltros.tsx` (v8.100.1).
 */
export interface ActiveFiltersInput {
  filterModo: string;
  filterEstado: string;
  filterCliente: string;
  filterOperador: string;
  filterProforma: string;
  fechaDesde: string;
  fechaHasta: string;
}

export function countActiveEmbarqueFilters(f: ActiveFiltersInput): number {
  let n = 0;
  if (f.filterModo && f.filterModo !== "todos") n++;
  if (f.filterEstado && f.filterEstado !== "todos") n++;
  if (f.filterCliente && f.filterCliente !== "todos") n++;
  if (f.filterOperador && f.filterOperador !== "todos") n++;
  if (f.filterProforma && f.filterProforma !== "todos") n++;
  if (f.fechaDesde) n++;
  if (f.fechaHasta) n++;
  return n;
}
