/**
 * `useClientPagedList<TRow, TFilters>` — variante del primitivo unificado para
 * páginas cuyo backend hoy devuelve el set completo (RPC sin `p_from/p_to`).
 *
 * Comparte contrato de URL y API con `useServerPagedList`:
 *   q, page, ps, sort, dir, from, to + filtros custom (nuqs).
 *
 * Recibe un dataset ya obtenido (típicamente vía `useQuery` sobre un RPC
 * existente) y aplica search/filter/sort/paginación en memoria. Cuando el RPC
 * migre a paginación real, el call-site cambia a `useServerPagedList` sin
 * tocar la UI (misma prop `pagination`, mismo `controlledSort`, misma barra).
 */
import { useCallback, useMemo } from "react";
import { useQueryState, parseAsString, parseAsStringLiteral } from "nuqs";
import { useTableFilters, type UseTableFiltersOpts, type ChipItem } from "@/hooks/shared/useTableFilters";
import type { SortDir, DataTablePagination } from "@/components/shared/dataTable/types";

export interface ClientPagedOpts<TRow, TFilters extends Record<string, string>>
  extends UseTableFiltersOpts<TFilters> {
  data: TRow[] | undefined;
  isLoading?: boolean;
  /** Devuelve string(s) donde buscar libre. */
  searchAccessor?: (row: TRow) => string;
  /** Filtra por filtros. Return `true` para conservar la fila. */
  filterPredicate?: (row: TRow, filters: TFilters) => boolean;
  /** Iso date del row para el rango `from`/`to`. */
  dateAccessor?: (row: TRow) => string | null | undefined;
  /** Comparadores por sortKey; el hook maneja la dirección. */
  sorters?: Record<string, (a: TRow, b: TRow) => number>;
  defaultSort?: { key: string; dir: SortDir };
}

export interface ClientPagedResult<TRow, TFilters extends Record<string, string>> {
  rows: TRow[];
  filteredCount: number;
  totalPages: number;
  isLoading: boolean;
  // Estado
  search: string;
  filters: TFilters;
  dateFrom: string;
  dateTo: string;
  page: number;
  pageSize: number;
  sortKey: string | null;
  sortDir: SortDir;
  // Setters
  setSearch: (v: string) => void;
  setFilter: <K extends keyof TFilters>(k: K, v: TFilters[K]) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  setPage: (p: number) => void;
  setPageSize: (s: number) => void;
  setSort: (key: string | null, dir: SortDir) => void;
  resetAll: () => void;
  // UI helpers
  activeChips: ChipItem[];
  activeCount: number;
  controlledSort: { key: string | null; dir: SortDir };
  pagination: DataTablePagination;
}

export function useClientPagedList<
  TRow,
  TFilters extends Record<string, string> = Record<string, string>,
>({
  data,
  isLoading = false,
  defaultFilters,
  filterLabels,
  defaultPageSize,
  searchAccessor,
  filterPredicate,
  dateAccessor,
  sorters,
  defaultSort,
}: ClientPagedOpts<TRow, TFilters>): ClientPagedResult<TRow, TFilters> {
  const f = useTableFilters<TFilters>({ defaultFilters, filterLabels, defaultPageSize });

  const [sortKeyRaw, setSortKeyRaw] = useQueryState(
    "sort",
    parseAsString.withDefault(defaultSort?.key ?? ""),
  );
  const [sortDirRaw, setSortDirRaw] = useQueryState(
    "dir",
    parseAsStringLiteral(["asc", "desc"] as const).withDefault(defaultSort?.dir ?? "desc"),
  );
  const sortKey = sortKeyRaw || defaultSort?.key || null;
  const sortDir = sortDirRaw as SortDir;

  const setSort = useCallback(
    (key: string | null, dir: SortDir) => {
      setSortKeyRaw(!key || key === (defaultSort?.key ?? null) ? null : key);
      setSortDirRaw(dir === (defaultSort?.dir ?? "desc") ? null : dir);
    },
    [defaultSort, setSortKeyRaw, setSortDirRaw],
  );

  const processed = useMemo(() => {
    let arr = (data ?? []).slice();

    // Search
    if (f.search && searchAccessor) {
      const needle = f.search.toLowerCase();
      arr = arr.filter((r) => searchAccessor(r).toLowerCase().includes(needle));
    }
    // Filtros
    if (filterPredicate) arr = arr.filter((r) => filterPredicate(r, f.filters));
    // Rango de fechas
    if ((f.dateFrom || f.dateTo) && dateAccessor) {
      arr = arr.filter((r) => f.isInRange(dateAccessor(r) ?? null));
    }
    // Sort
    if (sortKey && sorters?.[sortKey]) {
      const cmp = sorters[sortKey];
      arr.sort(cmp);
      if (sortDir === "desc") arr.reverse();
    }
    return arr;
  }, [data, f, filterPredicate, searchAccessor, dateAccessor, sortKey, sortDir, sorters]);

  const filteredCount = processed.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / f.pageSize));
  const rows = useMemo(
    () => processed.slice(f.page * f.pageSize, (f.page + 1) * f.pageSize),
    [processed, f.page, f.pageSize],
  );

  const pagination = useMemo<DataTablePagination>(
    () => ({
      page: f.page,
      totalPages,
      onPageChange: f.setPage,
      pageSize: f.pageSize,
      onPageSizeChange: f.setPageSize,
      pageSizeOptions: [10, 20, 50, 100],
      total: filteredCount,
    }),
    [f.page, f.pageSize, f.setPage, f.setPageSize, totalPages, filteredCount],
  );

  return {
    rows,
    filteredCount,
    totalPages,
    isLoading,
    search: f.search,
    filters: f.filters,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    page: f.page,
    pageSize: f.pageSize,
    sortKey,
    sortDir,
    setSearch: f.setSearch,
    setFilter: f.setFilter,
    setDateFrom: f.setDateFrom,
    setDateTo: f.setDateTo,
    setPage: f.setPage,
    setPageSize: f.setPageSize,
    setSort,
    resetAll: f.resetAll,
    activeChips: f.activeChips,
    activeCount: f.activeCount,
    controlledSort: { key: sortKey, dir: sortDir },
    pagination,
  };
}
