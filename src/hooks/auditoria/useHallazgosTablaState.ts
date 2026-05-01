/**
 * Hook de estado para la tabla paginada de hallazgos de auditoría.
 * Aísla filtros, paginación y derivaciones del componente UI.
 */
import { useMemo, useState } from "react";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export type FiltroRevision = "todos" | "pendientes" | "revisados";

export function useHallazgosTablaState(
  hallazgos: HallazgoAuditoria[],
  mostrarRevisadosDefault = false,
) {
  const defaultRevision: FiltroRevision = mostrarRevisadosDefault
    ? "todos"
    : "pendientes";

  const [search, setSearch] = useState("");
  const [filtroRegla, setFiltroRegla] = useState<ReglaAuditoria | "todas">("todas");
  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">("todas");
  const [filtroCliente, setFiltroCliente] = useState<string>("todos");
  const [filtroRevision, setFiltroRevision] = useState<FiltroRevision>(defaultRevision);
  const [etaDesde, setEtaDesde] = useState<Date | undefined>();
  const [etaHasta, setEtaHasta] = useState<Date | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data: revisiones } = useAuditoriaRevisiones();

  const clientes = useMemo(() => {
    const set = new Set(
      hallazgos.map((h) => h.cliente_nombre).filter((c): c is string => !!c),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [hallazgos]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    const desde = etaDesde ? etaDesde.toISOString().slice(0, 10) : null;
    const hasta = etaHasta ? etaHasta.toISOString().slice(0, 10) : null;
    return hallazgos.filter((h) => {
      if (q && !h.expediente?.toLowerCase().includes(q)) return false;
      if (filtroRegla !== "todas" && h.regla !== filtroRegla) return false;
      if (filtroSev !== "todas" && h.severidad !== filtroSev) return false;
      if (filtroCliente !== "todos" && h.cliente_nombre !== filtroCliente) return false;
      if (desde && (!h.eta || h.eta < desde)) return false;
      if (hasta && (!h.eta || h.eta > hasta)) return false;
      if (filtroRevision !== "todos") {
        const revisado = revisiones?.has(revisionKey(h)) ?? false;
        if (filtroRevision === "revisados" && !revisado) return false;
        if (filtroRevision === "pendientes" && revisado) return false;
      }
      return true;
    });
  }, [hallazgos, search, filtroRegla, filtroSev, filtroCliente, etaDesde, etaHasta, filtroRevision, revisiones]);

  const totalPages = Math.max(1, Math.ceil(filtrados.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibles = filtrados.slice(start, start + pageSize);

  const limpiar = () => {
    setSearch("");
    setFiltroRegla("todas");
    setFiltroSev("todas");
    setFiltroCliente("todos");
    setFiltroRevision(defaultRevision);
    setEtaDesde(undefined);
    setEtaHasta(undefined);
    setPage(1);
  };

  const hayFiltros = Boolean(
    search ||
      filtroRegla !== "todas" ||
      filtroSev !== "todas" ||
      filtroCliente !== "todos" ||
      filtroRevision !== defaultRevision ||
      etaDesde ||
      etaHasta,
  );

  // setter wrappers que resetean la paginación al cambiar filtro
  const wrap = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  return {
    // estado
    search,
    filtroRegla,
    filtroSev,
    filtroCliente,
    filtroRevision,
    etaDesde,
    etaHasta,
    pageSize,
    currentPage,
    totalPages,
    start,
    // datos
    revisiones,
    clientes,
    filtrados,
    visibles,
    hayFiltros,
    totalHallazgos: hallazgos.length,
    // acciones (con reset de paginación implícito)
    setSearch: wrap(setSearch),
    setFiltroRegla: wrap(setFiltroRegla),
    setFiltroSev: wrap(setFiltroSev),
    setFiltroCliente: wrap(setFiltroCliente),
    setFiltroRevision: wrap(setFiltroRevision),
    setEtaDesde: wrap(setEtaDesde),
    setEtaHasta: wrap(setEtaHasta),
    setPageSize: wrap(setPageSize),
    setPage,
    limpiar,
  };
}
