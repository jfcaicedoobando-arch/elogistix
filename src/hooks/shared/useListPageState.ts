/**
 * Hook genérico para estado de páginas de listado.
 *
 * Encapsula los 4 controles que se repiten en TODAS las páginas de listado del repo:
 *   search, page, pageSize y un blob de filtros tipado por el consumidor.
 *
 * v8.152.0 — el estado se sincroniza con la URL vía `nuqs` para que los
 * filtros sean compartibles, sobrevivan al refresh y queden registrados en el
 * historial del navegador. Cuando un valor está en su default no se serializa,
 * manteniendo la URL limpia (`/clientes` en vez de `/clientes?q=&page=0`).
 *
 * NO incluye la lógica de filtrado (es específica por página) — devuelve los
 * valores y setters, y un helper `paginate()` para cortar arrays ya filtrados.
 *
 * Patrones más complejos (Embarques con 7+ filtros + fechas) tienen su propio
 * controller (`useEmbarquesPageState`).
 */
import { useCallback, useMemo } from "react";
import {
  useQueryState,
  useQueryStates,
  parseAsInteger,
  parseAsString,
  type ParserBuilder,
} from "nuqs";

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
  const [search, setSearchRaw] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [page, setPageRaw] = useQueryState(
    "page",
    parseAsInteger.withDefault(0),
  );
  const [pageSize, setPageSizeRaw] = useQueryState(
    "ps",
    parseAsInteger.withDefault(defaultPageSize),
  );

  // Construye el mapa de parsers a partir de las claves de defaultFilters.
  // `useMemo` con dependencia vacía: la forma de los filtros se fija al montar
  // (igual que el hook anterior con `useState(defaultFilters)`).
  const filterParsers = useMemo(() => {
    const out: Record<string, ParserBuilder<string>> = {};
    for (const k of Object.keys(defaultFilters)) {
      out[k] = parseAsString.withDefault(defaultFilters[k]);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [filters, setFilters] = useQueryStates(filterParsers);

  const setSearch = useCallback(
    (value: string) => {
      // Pasamos null cuando vuelve al default para no ensuciar la URL.
      setSearchRaw(value || null);
      setPageRaw(null);
    },
    [setSearchRaw, setPageRaw],
  );

  const setFilter = useCallback(
    <K extends keyof TFilters>(key: K, value: TFilters[K]) => {
      const k = key as string;
      const isDefault = value === defaultFilters[k];
      setFilters({ [k]: isDefault ? null : value });
      setPageRaw(null);
    },
    [setFilters, setPageRaw, defaultFilters],
  );

  const setPage = useCallback(
    (p: number) => setPageRaw(p === 0 ? null : p),
    [setPageRaw],
  );

  const setPageSize = useCallback(
    (s: number) => {
      setPageSizeRaw(s === defaultPageSize ? null : s);
      setPageRaw(null);
    },
    [setPageSizeRaw, setPageRaw, defaultPageSize],
  );

  const resetPage = useCallback(() => setPageRaw(null), [setPageRaw]);

  const paginate = useCallback(
    <T,>(items: T[]) => ({
      items: items.slice(page * pageSize, (page + 1) * pageSize),
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    }),
    [page, pageSize],
  );

  return {
    search,
    filters: filters as TFilters,
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
