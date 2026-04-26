/**
 * Hook genérico para estado de páginas de listado.
 *
 * Encapsula los 4 controles que se repiten en TODAS las páginas de listado del repo:
 *   search, page, pageSize y un blob de filtros tipado por el consumidor.
 *
 * NO incluye la lógica de filtrado (es específica por página) — devuelve los
 * valores y setters, y un helper `paginate()` para cortar arrays ya filtrados.
 *
 * Patrones más complejos (Embarques con 7+ filtros + fechas) tienen su propio
 * controller (`useEmbarquesPageState`); este hook cubre los listados sencillos.
 */
import { useCallback, useState } from "react";

export const DEFAULT_PAGE_SIZE = 20;

export interface ListPageState<TFilters extends Record<string, string>> {
  // Estado
  search: string;
  filters: TFilters;
  page: number;
  pageSize: number;
  // Setters
  setSearch: (value: string) => void;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  resetPage: () => void;
  // Helpers
  /** Corta un array ya filtrado según la paginación actual. */
  paginate: <T>(items: T[]) => { items: T[]; totalPages: number };
}

export function useListPageState<TFilters extends Record<string, string>>(
  defaultFilters: TFilters,
  defaultPageSize: number = DEFAULT_PAGE_SIZE,
): ListPageState<TFilters> {
  const [search, setSearchRaw] = useState("");
  const [filters, setFilters] = useState<TFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Cualquier cambio de search/filtro vuelve a página 0 para evitar quedarse
  // en una página vacía después de filtrar.
  const setSearch = useCallback((value: string) => {
    setSearchRaw(value);
    setPage(0);
  }, []);

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(0);
    },
    [],
  );

  const resetPage = useCallback(() => setPage(0), []);

  const paginate = useCallback(
    <T,>(items: T[]) => ({
      items: items.slice(page * pageSize, (page + 1) * pageSize),
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    }),
    [page, pageSize],
  );

  return {
    search,
    filters,
    page,
    pageSize,
    setSearch,
    setFilter,
    setPage,
    setPageSize,
    resetPage,
    paginate,
  };
}
