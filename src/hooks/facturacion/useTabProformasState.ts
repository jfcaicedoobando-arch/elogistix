/**
 * Estado UI puro del tab de Proformas: filtros, paginación y derivados de filtrado.
 * Sin dependencias de mutaciones ni de columnas de UI.
 */
import { useState, useMemo } from "react";
import type { ProformaConFactura } from "@/hooks/embarque/useProformas";

const DEFAULT_PAGE_SIZE = 20;
export type FiltroEstadoProforma = "todas" | "pendiente" | "facturada";

export function useTabProformasState(proformas: ProformaConFactura[]) {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoProforma>("todas");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return proformas.filter((p) => {
      if (filtroEstado !== "todas" && (p.estado_proforma ?? "pendiente") !== filtroEstado) return false;
      if (!q) return true;
      return (
        p.numero.toLowerCase().includes(q) ||
        p.expediente.toLowerCase().includes(q) ||
        p.cliente_nombre.toLowerCase().includes(q) ||
        (p.folio_factura_externa ?? "").toLowerCase().includes(q)
      );
    });
  }, [proformas, search, filtroEstado]);

  const counts = useMemo(
    () => ({
      todas: proformas.length,
      pendiente: proformas.filter((p) => (p.estado_proforma ?? "pendiente") === "pendiente").length,
      facturada: proformas.filter((p) => p.estado_proforma === "facturada").length,
    }),
    [proformas],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(
    () => filtered.slice(page * pageSize, (page + 1) * pageSize),
    [filtered, page, pageSize],
  );

  return {
    search,
    filtroEstado,
    page,
    pageSize,
    setSearch: (v: string) => { setSearch(v); setPage(0); },
    setFiltroEstado: (v: FiltroEstadoProforma) => { setFiltroEstado(v); setPage(0); },
    setPage,
    setPageSize: (s: number) => { setPageSize(s); setPage(0); },
    filtered,
    paginated,
    counts,
    totalPages,
  };
}
