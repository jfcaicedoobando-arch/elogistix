/**
 * Estado y filtros de la página de listado de Embarques.
 *
 * v8.153.2 — Cuando hay filtro por estado, se trae el set COMPLETO (sin paginar
 * server-side) porque el estado real se calcula client-side a partir de
 * etd/eta/estado. Sobre ese set se filtra, se agrupa por expediente, se
 * ordena y se pagina. Esto garantiza que:
 *  - Los conteos del dashboard (contenedores) cuadren con el listado.
 *  - El expediente no "desaparezca" al cambiar el tamaño de página.
 *
 * Sin filtro de estado se mantiene la paginación server-side original.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
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
import type { SortableEmbarqueColumn, EmbarqueListExtras } from "@/services/embarque/queries";
import { SORT_KEY_TO_COLUMN } from "@/services/embarque/queries";
import { fetchEmbarquesParaExport, fetchEmbarquesListExtras } from "@/services/embarque";
import { useOrgFilter } from "@/hooks/shared/useOrgFilter";
import { queryKeys } from "@/lib/query";

const DEFAULT_PAGE_SIZE = 20;
export type SortDir = "asc" | "desc";

const SORT_DIR_PARSER = parseAsStringLiteral(["asc", "desc"] as const).withDefault("desc");

function compareBy(a: EmbarqueRow, b: EmbarqueRow, sortKey: string | null, dir: SortDir): number {
  const mult = dir === "asc" ? 1 : -1;
  const key = sortKey ?? "expediente";
  const getVal = (e: EmbarqueRow): string | number => {
    switch (key) {
      case "expediente": return e.expediente ?? "";
      case "cliente": return e.cliente_nombre ?? "";
      case "modo": return e.modo ?? "";
      case "estado": return e.estado ?? "";
      case "etd": return e.etd ?? "";
      case "eta": return e.eta ?? "";
      case "operador": return e.operador ?? "";
      case "created_at": return e.created_at ?? "";
      default: return e.expediente ?? "";
    }
  };
  const va = getVal(a);
  const vb = getVal(b);
  if (va < vb) return -1 * mult;
  if (va > vb) return 1 * mult;
  return 0;
}

export function useEmbarquesPageState() {
  const { organizationId } = useOrgFilter();
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
  const estadoFilterActivo = filterEstado !== "todos";

  const sortBy: SortableEmbarqueColumn | undefined = sortKey ? SORT_KEY_TO_COLUMN[sortKey] : undefined;

  // ---------- Rama A: sin filtro de estado → paginación server-side ----------
  const { data: resultadoServer, isLoading: loadingServer } = useEmbarquesPaginados({
    search: debouncedSearch,
    filterModo,
    filterEstado: "todos",
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

  // ---------- Rama B: con filtro de estado → fetch completo + filtrado client ----------
  const fullSetFilters = {
    organizationId,
    search: debouncedSearch,
    filterModo,
    filterCliente,
    filterOperador,
    filterProforma,
    fechaDesde: fechaDesde || undefined,
    fechaHasta: fechaHasta || undefined,
  };
  const { data: resultadoFull, isLoading: loadingFull } = useQuery({
    queryKey: [...queryKeys.embarques.all, "full-for-estado-filter", fullSetFilters],
    queryFn: () => fetchEmbarquesParaExport(fullSetFilters),
    enabled: estadoFilterActivo,
    staleTime: 60_000,
  });

  const isLoading = estadoFilterActivo ? loadingFull : loadingServer;

  // Set de contenedores que alimenta los conteos y la paginación visual.
  const containersForView: EmbarqueRow[] = useMemo(() => {
    if (!estadoFilterActivo) return resultadoServer?.data ?? [];
    const all = resultadoFull ?? [];
    return all.filter(
      (e) => calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado) === filterEstado,
    );
  }, [estadoFilterActivo, resultadoServer, resultadoFull, filterEstado]);

  // Conteo de contenedores por expediente sobre el set visible/filtrado.
  const contenedoresPorExpediente = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of containersForView) {
      if (!e.expediente) continue;
      map[e.expediente] = (map[e.expediente] ?? 0) + 1;
    }
    return map;
  }, [containersForView]);

  // Dedupe a una fila por expediente (mantiene primer registro).
  const dedupedAll = useMemo(() => {
    const seen = new Set<string>();
    const out: EmbarqueRow[] = [];
    for (const e of containersForView) {
      const key = e.expediente ?? e.id;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(e);
    }
    return out;
  }, [containersForView]);

  // Orden + paginación: client-side cuando hay filtro de estado (porque el set
  // completo ya vive en memoria); server-side en el caso por defecto.
  const sortedAll = useMemo(() => {
    if (!estadoFilterActivo) return dedupedAll;
    return [...dedupedAll].sort((a, b) => compareBy(a, b, sortKey, sortDir));
  }, [estadoFilterActivo, dedupedAll, sortKey, sortDir]);

  const totalCountServer = resultadoServer?.count ?? 0;

  const expedientesCount = estadoFilterActivo
    ? dedupedAll.length
    : totalCountServer; // sin filtro no tenemos dedupe global; mostramos contenedores como aprox.
  const contenedoresCount = estadoFilterActivo
    ? containersForView.length
    : totalCountServer;

  const totalPages = estadoFilterActivo
    ? Math.max(1, Math.ceil(sortedAll.length / pageSize))
    : Math.max(1, Math.ceil(totalCountServer / pageSize));

  // Filas visibles en la página actual.
  const filtered = useMemo(() => {
    if (!estadoFilterActivo) return dedupedAll;
    const from = page * pageSize;
    return sortedAll.slice(from, from + pageSize);
  }, [estadoFilterActivo, dedupedAll, sortedAll, page, pageSize]);

  const embarques: EmbarqueRow[] = estadoFilterActivo
    ? filtered // ya paginado
    : (resultadoServer?.data ?? []);

  const displayCount = expedientesCount;

  const isEmptyState =
    !isLoading &&
    containersForView.length === 0 &&
    !debouncedSearch &&
    filterModo === "todos" &&
    filterEstado === "todos" &&
    filterCliente === "todos" &&
    filterOperador === "todos" &&
    filterProforma === "todos" &&
    !fechaDesde &&
    !fechaHasta;

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
      setSortKeyRaw(!key || key === "expediente" ? null : key);
      setSortDirRaw(dir === "desc" ? null : dir);
      setPageRaw(null);
    },
    // data
    embarques, filtered, totalCount: totalCountServer, displayCount,
    expedientesCount, contenedoresCount, totalPages, isLoading, isEmptyState,
    contenedoresPorExpediente,
  };
}
