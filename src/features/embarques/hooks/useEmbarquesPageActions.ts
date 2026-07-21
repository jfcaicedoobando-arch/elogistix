/**
 * Setters agrupados para `useEmbarquesPageState` — extraídos para reducir
 * la complejidad ciclomática del hook principal.
 */
import type { SortDir } from "@/features/embarques/domain/embarquesPageHelpers";

type SetFilter = (key: "modo" | "estado" | "cliente" | "operador" | "fechaDesde" | "fechaHasta", value: string, defaultValue: string) => void;

interface BuildActionsArgs<A> {
  DEFAULT_PAGE_SIZE: number;
  setFilter: SetFilter;
  setAlerta: (v: A) => void;
  setPageRaw: (v: number | null) => void;
  setPageSizeRaw: (v: number | null) => void;
  setSortKeyRaw: (v: string | null) => void;
  setSortDirRaw: (v: SortDir | null) => void;
}

export function buildEmbarquesPageActions<A>(args: BuildActionsArgs<A>) {
  const {
    DEFAULT_PAGE_SIZE, setFilter, setAlerta,
    setPageRaw, setPageSizeRaw, setSortKeyRaw, setSortDirRaw,
  } = args;
  return {
    setFilterModo: (v: string) => setFilter("modo", v, "todos"),
    setFilterEstado: (v: string) => setFilter("estado", v, "todos"),
    setFilterCliente: (v: string) => setFilter("cliente", v, "todos"),
    setFilterOperador: (v: string) => setFilter("operador", v, "todos"),
    setFilterAlerta: setAlerta,
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
  };
}
