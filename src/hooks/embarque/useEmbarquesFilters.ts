/**
 * Estado de filtros y ordenamiento para la página de embarques (extraído de
 * `useEmbarquesPageState` para reducir complejidad).
 */
import {
  useQueryState,
  useQueryStates,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import { useDebounce } from "@/hooks/shared/useDebounce";

export type SortDir = "asc" | "desc";
const SORT_DIR_PARSER = parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc");
const DEFAULT_PAGE_SIZE = 20;

export function useEmbarquesFilters() {
  const [search, setSearchRaw] = useQueryState("q", parseAsString.withDefault(""));
  const [filters, setFilters] = useQueryStates({
    modo: parseAsString.withDefault("todos"),
    estado: parseAsString.withDefault("todos"),
    cliente: parseAsString.withDefault("todos"),
    operador: parseAsString.withDefault("todos"),
    
    fechaDesde: parseAsString.withDefault(""),
    fechaHasta: parseAsString.withDefault(""),
  });
  const [page, setPageRaw] = useQueryState("page", parseAsInteger.withDefault(0));
  const [pageSize, setPageSizeRaw] = useQueryState(
    "ps",
    parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  );
  const [sortKey, setSortKeyRaw] = useQueryState("sort", parseAsString.withDefault("expediente"));
  const [sortDir, setSortDirRaw] = useQueryState("dir", SORT_DIR_PARSER);

  const debouncedSearch = useDebounce(search, 300);

  const setFilter = (key: keyof typeof filters, value: string, defaultValue: string) => {
    setFilters({ [key]: value === defaultValue ? null : value });
    setPageRaw(null);
  };

  return {
    search,
    debouncedSearch,
    filters,
    page,
    pageSize,
    sortKey,
    sortDir,
    DEFAULT_PAGE_SIZE,
    setSearch: (v: string) => { setSearchRaw(v || null); setPageRaw(null); },
    setFilter,
    setPageRaw,
    setPageSizeRaw,
    setSortKeyRaw,
    setSortDirRaw,
  };
}
