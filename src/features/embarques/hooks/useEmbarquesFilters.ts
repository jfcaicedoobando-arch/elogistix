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
import { useDebounce } from "@/hooks/shared";

// v13.139.17 — default reducido de 100 → 50 para evitar páginas de 4700px+
// en monitores Full HD. El usuario puede subir hasta 500 desde el selector.
const DEFAULT_PAGE_SIZE = 50;


const SORT_DIR_PARSER = parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc");
const ALERTA_PARSER = parseAsStringLiteral([
  "todos",
  "demora",
  "garantia",
  "admin_pendiente",
] as const).withDefault("todos");

export type EmbarqueAlertaFiltro = "todos" | "demora" | "garantia" | "admin_pendiente";

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
  const [alerta, setAlertaRaw] = useQueryState("alerta", ALERTA_PARSER);
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
    alerta: alerta as EmbarqueAlertaFiltro,
    page,
    pageSize,
    sortKey,
    sortDir,
    DEFAULT_PAGE_SIZE,
    setSearch: (v: string) => { setSearchRaw(v || null); setPageRaw(null); },
    setFilter,
    setAlerta: (v: EmbarqueAlertaFiltro) => {
      setAlertaRaw(v === "todos" ? null : v);
      setPageRaw(null);
    },
    setPageRaw,
    setPageSizeRaw,
    setSortKeyRaw,
    setSortDirRaw,
  };
}
