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
import { useCallback, useMemo, useRef } from "react";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import {
  useQueryState,
  useQueryStates,
  parseAsInteger,
  parseAsString,
  type ParserBuilder,
} from "nuqs";

export const DEFAULT_PAGE_SIZE = 100;

function normalizePageSize(size: number, defaultSize: number, options?: readonly number[]): number {
  if (!Number.isSafeInteger(size) || size <= 0) return defaultSize;
  const allowed = options ? size === defaultSize || options.includes(size) : size <= defaultSize;
  return allowed ? size : defaultSize;
}

function normalizePage(page: number, pageSize: number): number {
  // También protege los offsets/rangos calculados por los consumidores.
  return Number.isSafeInteger(page) && page >= 0 && Number.isSafeInteger((page + 1) * pageSize)
    ? page
    : 0;
}

export interface ListPageState<TFilters extends Record<string, string>> {
  // Estado
  search: string;
  /**
   * EC-9 · Ola 5 — `search` con debounce (300 ms). Úsalo para filtrar/consultar;
   * `search` se mantiene para el valor del input (escritura sin lag).
   */
  searchDebounced: string;
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
  /** Opciones reales del listado; sin ellas se admite 1..defaultPageSize. */
  pageSizeOptions?: readonly number[],
): ListPageState<TFilters> {
  const defaultSize = Number.isSafeInteger(defaultPageSize) && defaultPageSize > 0
    ? defaultPageSize
    : DEFAULT_PAGE_SIZE;
  // Los callers pueden declarar sus opciones inline sin volver inestables
  // los setters en cada render.
  const sizeOptionsKey = pageSizeOptions?.join(",");
  const sizeOptions = useMemo(
    () => sizeOptionsKey === undefined ? undefined : sizeOptionsKey.split(",").map(Number),
    [sizeOptionsKey],
  );
  const [search, setSearchRaw] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [pageRaw, setPageRaw] = useQueryState(
    "page",
    parseAsInteger.withDefault(0),
  );
  const [pageSizeRaw, setPageSizeRaw] = useQueryState(
    "ps",
    parseAsInteger.withDefault(defaultSize),
  );
  // Normaliza en el render, antes de cualquier slice/range/query. No escribe
  // la URL al leerla: Back/Forward conserva cada entrada y sus filtros.
  const pageSize = normalizePageSize(pageSizeRaw, defaultSize, sizeOptions);
  const page = normalizePage(pageRaw, pageSize);

  // Construye el mapa de parsers a partir de las claves de defaultFilters.
  // La forma de los filtros se fija al montar (snapshot vía ref) para no
  // recrear los parsers si el caller pasa un objeto inline en cada render.
  const defaultFiltersRef = useRef(defaultFilters);
  const filterParsers = useMemo(() => {
    const out: Record<string, ParserBuilder<string>> = {};
    const snapshot = defaultFiltersRef.current;
    for (const k of Object.keys(snapshot)) {
      out[k] = parseAsString.withDefault(snapshot[k]);
    }
    return out;
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
    (p: number) => {
      const nextPage = normalizePage(p, pageSize);
      setPageRaw(nextPage === 0 ? null : nextPage);
    },
    [setPageRaw, pageSize],
  );

  const setPageSize = useCallback(
    (s: number) => {
      const nextSize = normalizePageSize(s, defaultSize, sizeOptions);
      setPageSizeRaw(nextSize === defaultSize ? null : nextSize);
      setPageRaw(null);
    },
    [setPageSizeRaw, setPageRaw, defaultSize, sizeOptions],
  );

  const resetPage = useCallback(() => setPageRaw(null), [setPageRaw]);

  // EC-9: evita re-filtrar/re-consultar en cada tecla.
  const searchDebounced = useDebouncedValue(search, 300);

  const paginate = useCallback(
    <T,>(items: T[]) => ({
      items: items.slice(page * pageSize, (page + 1) * pageSize),
      totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
    }),
    [page, pageSize],
  );

  return {
    search,
    searchDebounced,
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
