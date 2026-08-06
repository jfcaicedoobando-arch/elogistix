/**
 * `useServerPagedList<TRow, TFilters>` — primitivo compartido para listados.
 *
 * Combina:
 *  - `useTableFilters` (URL sync vía nuqs: q, page, ps, filtros, from/to)
 *  - orden controlado (sort, dir sincronizados con la URL)
 *  - `useQuery` de TanStack con un fetcher que recibe TODO el estado y devuelve
 *    `{ rows, count }` de la página solicitada.
 *
 * Objetivo: que cualquier página de listado (Cartera, CxP, Comisiones, CRM,
 * Portal, Admin, Config, Costeo) use exactamente los mismos parámetros de URL
 * y la misma barra `<UnifiedFiltersBar />`, sin importar si su backend es un
 * RPC con paginación real o un RPC que devuelve todo el set y paginamos aquí.
 *
 * Cuando un RPC no acepta aún `p_from/p_to/p_sort_*`, el fetcher puede pedir
 * el set completo y cortar en memoria — la firma queda estable para migrar a
 * paginación real sin cambiar el call-site (ola siguiente del plan).
 */
import { useCallback, useMemo } from "react";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useQueryState, parseAsString, parseAsStringLiteral } from "nuqs";
import { useTableFilters, type UseTableFiltersOpts } from "@/hooks/shared/useTableFilters";
import type { SortDir, DataTablePagination } from "@/components/shared/dataTable/types";

export interface ServerPagedFetcherArgs<TFilters extends Record<string, string>> {
  search: string;
  filters: TFilters;
  dateFrom: string;
  dateTo: string;
  sortKey: string | null;
  sortDir: SortDir;
  /** Rango 0-indexed `[from, to]` inclusivo para `.range(from, to)` de Supabase. */
  range: { from: number; to: number };
  page: number;
  pageSize: number;
}

export interface ServerPagedResult<TRow> {
  rows: TRow[];
  count: number;
}

export interface UseServerPagedListOpts<TRow, TFilters extends Record<string, string>>
  extends UseTableFiltersOpts<TFilters> {
  /** Prefijo de queryKey (se concatena con todo el estado). */
  queryKey: QueryKey;
  fetcher: (args: ServerPagedFetcherArgs<TFilters>) => Promise<ServerPagedResult<TRow>>;
  defaultSort?: { key: string; dir: SortDir };
  /** Sort keys válidos (whitelist) — evita inyecciones y ensuring server contract. */
  sortableKeys?: readonly string[];
  staleTime?: number;
  enabled?: boolean;
}

function useUrlSort(sortableKeys: readonly string[] | undefined, defaultSort?: { key: string; dir: SortDir }) {
  const parser = sortableKeys && sortableKeys.length
    ? parseAsStringLiteral(sortableKeys).withDefault(defaultSort?.key ?? sortableKeys[0])
    : parseAsString.withDefault(defaultSort?.key ?? "");
  const [sortKeyRaw, setSortKeyRaw] = useQueryState("sort", parser);
  const [sortDirRaw, setSortDirRaw] = useQueryState(
    "dir",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault(defaultSort?.dir ?? "desc"),
  );
  const sortKey = (sortKeyRaw || defaultSort?.key || null) as string | null;
  const sortDir = (sortDirRaw as SortDir) ?? (defaultSort?.dir ?? "desc");
  const setSort = useCallback(
    (key: string | null, dir: SortDir) => {
      const isDefaultKey = key === (defaultSort?.key ?? null);
      const isDefaultDir = dir === (defaultSort?.dir ?? "desc");
      setSortKeyRaw(!key || isDefaultKey ? null : key);
      setSortDirRaw(isDefaultDir ? null : dir);
    },
    [defaultSort, setSortKeyRaw, setSortDirRaw],
  );
  return { sortKey, sortDir, setSort };
}

export function useServerPagedList<
  TRow,
  TFilters extends Record<string, string> = Record<string, string>,
>({
  queryKey,
  fetcher,
  defaultFilters,
  filterLabels,
  defaultPageSize,
  defaultSort,
  sortableKeys,
  staleTime = 30_000,
  enabled = true,
}: UseServerPagedListOpts<TRow, TFilters>) {
  const filtersState = useTableFilters<TFilters>({
    defaultFilters,
    filterLabels,
    defaultPageSize,
  });

  const { sortKey, sortDir, setSort } = useUrlSort(sortableKeys, defaultSort);

  const from = filtersState.page * filtersState.pageSize;
  const to = from + filtersState.pageSize - 1;

  const fetchArgs: ServerPagedFetcherArgs<TFilters> = {
    search: filtersState.search,
    filters: filtersState.filters,
    dateFrom: filtersState.dateFrom,
    dateTo: filtersState.dateTo,
    sortKey,
    sortDir,
    range: { from, to },
    page: filtersState.page,
    pageSize: filtersState.pageSize,
  };

  // Composición genérica de la key base (provista por el caller vía factory
  // de su dominio) con el estado de filtros/orden/paginación. Se calcula en
  // variable para que el `Property` de `queryKey` sea un Identifier y no un
  // ArrayExpression inline (guardrail `no-restricted-syntax`).
  const fullQueryKey: QueryKey = [
    ...queryKey,
    filtersState.search,
    filtersState.filters,
    filtersState.dateFrom,
    filtersState.dateTo,
    sortKey,
    sortDir,
    filtersState.page,
    filtersState.pageSize,
  ];

  const query = useQuery({
    queryKey: fullQueryKey,
    queryFn: () => fetcher(fetchArgs),
    staleTime,
    enabled,
    placeholderData: (prev) => prev,
  });

  const rows = query.data?.rows ?? [];
  const count = query.data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(count / filtersState.pageSize));

  const pagination = useMemo<DataTablePagination>(
    () => ({
      page: filtersState.page,
      totalPages,
      onPageChange: filtersState.setPage,
      pageSize: filtersState.pageSize,
      onPageSizeChange: filtersState.setPageSize,
      pageSizeOptions: [10, 20, 50, 100],
      total: count,
    }),
    [filtersState.page, filtersState.pageSize, filtersState.setPage, filtersState.setPageSize, totalPages, count],
  );

  return {
    // Datos
    rows,
    count,
    totalPages,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    // Estado de filtros/orden (para armar barra y columnas)
    ...filtersState,
    sortKey,
    sortDir,
    setSort,
    controlledSort: { key: sortKey, dir: sortDir },
    // Para pasar directo al `<DataTable pagination={...}>`
    pagination,
  };
}
