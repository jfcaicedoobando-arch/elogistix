/**
 * Estado y filtros de la página de listado de Embarques.
 * Extraído de src/pages/Embarques.tsx para separar UI de orquestación.
 *
 * v8.152.0 — todos los filtros, paginación y orden se sincronizan con la URL
 * vía `nuqs`. Esto reemplaza el patrón anterior de `useState + useSearchParams`
 * con lectura unidireccional al montar y permite compartir un listado
 * pre-filtrado con un link (p. ej. desde /operaciones).
 */
import { useMemo } from "react";
import {
  useQueryState,
  useQueryStates,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
} from "nuqs";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useEmbarquesPaginados, calcularEstadoEmbarque } from "@/hooks/embarque/useEmbarques";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import type { SortableEmbarqueColumn } from "@/services/embarque/queries";
import { SORT_KEY_TO_COLUMN } from "@/services/embarque/queries";

const DEFAULT_PAGE_SIZE = 20;
export type SortDir = "asc" | "desc";

const SORT_DIR_PARSER = parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc");

export function useEmbarquesPageState() {
  const [search, setSearchRaw] = useQueryState("q", parseAsString.withDefault(""));
  const [filters, setFilters] = useQueryStates({
    modo: parseAsString.withDefault("todos"),
    estado: parseAsString.withDefault("todos"),
    cliente: parseAsString.withDefault("todos"),
    operador: parseAsString.withDefault("todos"),
    proforma: parseAsString.withDefault("todos"),
    fechaDesde: parseAsString.withDefault(""),
    fechaHasta: parseAsString.withDefault(""),
  });
  const [page, setPageRaw] = useQueryState("page", parseAsInteger.withDefault(0));
  const [pageSize, setPageSizeRaw] = useQueryState(
    "ps",
    parseAsInteger.withDefault(DEFAULT_PAGE_SIZE),
  );
  const [sortKey, setSortKeyRaw] = useQueryState(
    "sort",
    parseAsString.withDefault("expediente"),
  );
  const [sortDir, setSortDirRaw] = useQueryState("dir", SORT_DIR_PARSER);

  const filterModo = filters.modo;
  const filterEstado = filters.estado;
  const filterCliente = filters.cliente;
  const filterOperador = filters.operador;
  const filterProforma = filters.proforma;
  const fechaDesde = filters.fechaDesde;
  const fechaHasta = filters.fechaHasta;

  const debouncedSearch = useDebounce(search, 300);

  const sortBy: SortableEmbarqueColumn | undefined = sortKey ? SORT_KEY_TO_COLUMN[sortKey] : undefined;

  const { data: resultado, isLoading } = useEmbarquesPaginados({
    search: debouncedSearch,
    filterModo,
    filterEstado,
    filterCliente,
    filterOperador,
    filterProforma,
    page,
    pageSize,
    fechaDesde,
    fechaHasta,
    sortBy,
    sortDir: sortBy ? sortDir : undefined,
  });

  const embarques: EmbarqueRow[] = resultado?.data ?? [];
  const totalCount = resultado?.count ?? 0;

  // Conteo de contenedores por expediente (un embarque por contenedor en BD).
  const contenedoresPorExpediente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of embarques) {
      if (!e.expediente) continue;
      map[e.expediente] = (map[e.expediente] ?? 0) + 1;
    }
    return map;
  }, [embarques]);

  // Dedupe presentacional: una fila por expediente (mantiene primer registro).
  const dedupedEmbarques = useMemo(() => {
    const seen = new Set<string>();
    const out: EmbarqueRow[] = [];
    for (const e of embarques) {
      const key = e.expediente ?? e.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }, [embarques]);

  const filtered = useMemo(() => {
    if (filterEstado === "todos") return dedupedEmbarques;
    return dedupedEmbarques.filter((e) => {
      const estadoCalculado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      return estadoCalculado === filterEstado;
    });
  }, [dedupedEmbarques, filterEstado]);

  const displayCount = filterEstado !== "todos" ? filtered.length : Object.keys(contenedoresPorExpediente).length || totalCount;
  const totalPages = filterEstado !== "todos" ? 1 : Math.ceil(totalCount / pageSize);

  const isEmptyState =
    !isLoading &&
    totalCount === 0 &&
    !debouncedSearch &&
    filterModo === "todos" &&
    filterEstado === "todos" &&
    filterCliente === "todos" &&
    filterOperador === "todos" &&
    filterProforma === "todos" &&
    !fechaDesde &&
    !fechaHasta;

  // Helper para colapsar valores default a `null` y mantener la URL limpia.
  const setFilter = (key: keyof typeof filters, value: string, defaultValue: string) => {
    setFilters({ [key]: value === defaultValue ? null : value });
    setPageRaw(null);
  };

  return {
    // values
    search,
    filterModo, filterEstado, filterCliente, filterOperador, filterProforma,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch,
    sortKey, sortDir,
    // setters
    setSearch: (v: string) => { setSearchRaw(v || null); setPageRaw(null); },
    setFilterModo: (v: string) => setFilter("modo", v, "todos"),
    setFilterEstado: (v: string) => setFilter("estado", v, "todos"),
    setFilterCliente: (v: string) => setFilter("cliente", v, "todos"),
    setFilterOperador: (v: string) => setFilter("operador", v, "todos"),
    setFilterProforma: (v: string) => setFilter("proforma", v, "todos"),
    setFechaDesde: (v: string) => setFilter("fechaDesde", v, ""),
    setFechaHasta: (v: string) => setFilter("fechaHasta", v, ""),
    setPage: (p: number) => setPageRaw(p === 0 ? null : p),
    setPageSize: (s: number) => {
      setPageSizeRaw(s === DEFAULT_PAGE_SIZE ? null : s);
      setPageRaw(null);
    },
    handleSortChange: (key: string | null, dir: SortDir) => {
      // Default es expediente/desc; colapsamos a null cuando coincide.
      setSortKeyRaw(!key || key === "expediente" ? null : key);
      setSortDirRaw(dir === "desc" ? null : dir);
      setPageRaw(null);
    },
    // data
    embarques, filtered, totalCount, displayCount, totalPages, isLoading, isEmptyState,
    contenedoresPorExpediente,
  };
}
