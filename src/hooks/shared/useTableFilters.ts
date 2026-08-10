/**
 * `useTableFilters<TFilters>` — extiende `useListPageState` con rango de
 * fechas y helpers para armar los chips activos que consume
 * `<UnifiedFiltersBar />`.
 *
 * Es un superset compatible: cualquier página que hoy usa
 * `useListPageState({ ... })` puede migrar cambiando la importación y
 * añadiendo los campos `dateFrom` / `dateTo` cuando los necesite.
 *
 * URL sync sigue provisto por `nuqs` (heredado de `useListPageState`).
 */
import { useCallback, useMemo } from "react";
import { useQueryState, parseAsString } from "nuqs";
import { useListPageState, DEFAULT_PAGE_SIZE } from "@/hooks/shared/useListPageState";

export interface ChipItem {
  key: string;
  label: string;
  onRemove: () => void;
}

export interface UseTableFiltersOpts<TFilters extends Record<string, string>> {
  defaultFilters: TFilters;
  defaultPageSize?: number;
  /** Etiquetas legibles por clave para mostrar chips. */
  filterLabels?: Partial<Record<keyof TFilters, string>>;
}

export interface TableFiltersState<TFilters extends Record<string, string>> {
  search: string;
  filters: TFilters;
  page: number;
  pageSize: number;
  dateFrom: string;
  dateTo: string;
  setSearch: (v: string) => void;
  setFilter: <K extends keyof TFilters>(key: K, value: TFilters[K]) => void;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  setDateFrom: (v: string) => void;
  setDateTo: (v: string) => void;
  resetAll: () => void;
  isInRange: (iso: string | null | undefined) => boolean;
  activeChips: ChipItem[];
  activeCount: number;
  paginate: <T>(items: T[]) => { items: T[]; totalPages: number };
}

export function useTableFilters<TFilters extends Record<string, string>>({
  defaultFilters,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  filterLabels,
}: UseTableFiltersOpts<TFilters>): TableFiltersState<TFilters> {
  const base = useListPageState<TFilters>(defaultFilters, defaultPageSize);

  const [dateFrom, setDateFromRaw] = useQueryState(
    "from",
    parseAsString.withDefault(""),
  );
  const [dateTo, setDateToRaw] = useQueryState(
    "to",
    parseAsString.withDefault(""),
  );

  // M12 (Ola 7): al mover el rango de fechas el conjunto de resultados cambia
  // por completo; quedarse en la página 7 mostraba una tabla vacía. Se regresa
  // siempre a la primera página, igual que ya hacen `setSearch`/`setFilter`.
  const setDateFrom = useCallback(
    (v: string) => {
      setDateFromRaw(v || null);
      base.setPage(0);
    },
    [setDateFromRaw, base],
  );
  const setDateTo = useCallback(
    (v: string) => {
      setDateToRaw(v || null);
      base.setPage(0);
    },
    [setDateToRaw, base],
  );

  const isInRange = useCallback(
    (iso: string | null | undefined) => {
      if (!iso) return !dateFrom && !dateTo;
      if (dateFrom && iso < dateFrom) return false;
      if (dateTo && iso > dateTo) return false;
      return true;
    },
    [dateFrom, dateTo],
  );

  const resetAll = useCallback(() => {
    base.setSearch("");
    (Object.keys(defaultFilters) as (keyof TFilters)[]).forEach((k) => {
      base.setFilter(k, defaultFilters[k]);
    });
    setDateFromRaw(null);
    setDateToRaw(null);
  }, [base, defaultFilters, setDateFromRaw, setDateToRaw]);

  const activeChips = useMemo<ChipItem[]>(() => {
    const chips: ChipItem[] = [];
    for (const k of Object.keys(defaultFilters) as (keyof TFilters)[]) {
      const value = base.filters[k];
      if (value && value !== defaultFilters[k]) {
        const label = filterLabels?.[k] ?? String(k);
        chips.push({
          key: `filter:${String(k)}`,
          label: `${label}: ${value}`,
          onRemove: () => base.setFilter(k, defaultFilters[k]),
        });
      }
    }
    if (dateFrom) {
      chips.push({
        key: "dateFrom",
        label: `Desde: ${dateFrom}`,
        onRemove: () => setDateFromRaw(null),
      });
    }
    if (dateTo) {
      chips.push({
        key: "dateTo",
        label: `Hasta: ${dateTo}`,
        onRemove: () => setDateToRaw(null),
      });
    }
    return chips;
  }, [base, defaultFilters, filterLabels, dateFrom, dateTo, setDateFromRaw, setDateToRaw]);

  return {
    search: base.search,
    filters: base.filters,
    page: base.page,
    pageSize: base.pageSize,
    dateFrom,
    dateTo,
    setSearch: base.setSearch,
    setFilter: base.setFilter,
    setPage: base.setPage,
    setPageSize: base.setPageSize,
    setDateFrom,
    setDateTo,
    resetAll,
    isInRange,
    activeChips,
    activeCount: activeChips.length + (base.search ? 1 : 0),
    paginate: base.paginate,
  };
}
