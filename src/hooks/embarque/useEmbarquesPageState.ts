/**
 * Estado y filtros de la página de listado de Embarques.
 * Extraído de src/pages/Embarques.tsx para separar UI de orquestación.
 */
import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/shared/useDebounce";
import { useEmbarquesPaginados, calcularEstadoEmbarque } from "@/hooks/embarque/useEmbarques";
import type { EmbarqueRow } from "@/hooks/embarque/useEmbarques";
import type { SortableEmbarqueColumn } from "@/services/embarque/queries";
import { SORT_KEY_TO_COLUMN } from "@/services/embarque/queries";

const DEFAULT_PAGE_SIZE = 20;
export type SortDir = "asc" | "desc";

export function useEmbarquesPageState() {
  const [search, setSearch] = useState("");
  const [filterModo, setFilterModo] = useState<string>("todos");
  const [filterEstado, setFilterEstado] = useState<string>("todos");
  const [filterCliente, setFilterCliente] = useState<string>("todos");
  const [filterOperador, setFilterOperador] = useState<string>("todos");
  const [filterProforma, setFilterProforma] = useState<string>("todos");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Sort server-side. null = orden default (created_at desc).
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const filtered = useMemo(() => {
    if (filterEstado === "todos") return embarques;
    return embarques.filter((e) => {
      const estadoCalculado = calcularEstadoEmbarque(e.modo, e.tipo, e.etd, e.eta, e.estado);
      return estadoCalculado === filterEstado;
    });
  }, [embarques, filterEstado]);

  const displayCount = filterEstado !== "todos" ? filtered.length : totalCount;
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

  // Setters que resetean a página 0
  const wrap = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(0); };

  // Ciclo: null → asc → desc → null
  const handleSortChange = (key: string | null, dir: SortDir) => {
    setSortKey(key);
    setSortDir(dir);
    setPage(0);
  };

  return {
    // values
    search, filterModo, filterEstado, filterCliente, filterOperador, filterProforma,
    fechaDesde, fechaHasta, page, pageSize, debouncedSearch,
    sortKey, sortDir,
    // setters
    setSearch: wrap(setSearch),
    setFilterModo: wrap(setFilterModo),
    setFilterEstado: wrap(setFilterEstado),
    setFilterCliente: wrap(setFilterCliente),
    setFilterOperador: wrap(setFilterOperador),
    setFilterProforma: wrap(setFilterProforma),
    setFechaDesde: wrap(setFechaDesde),
    setFechaHasta: wrap(setFechaHasta),
    setPage,
    setPageSize: (s: number) => { setPageSize(s); setPage(0); },
    handleSortChange,
    // data
    embarques, filtered, totalCount, displayCount, totalPages, isLoading, isEmptyState,
  };
}
