/**
 * Hook de estado para la tabla paginada de hallazgos de auditoría.
 * Aísla filtros, paginación y derivaciones del componente UI.
 */
import { useMemo, useState } from "react";
import {
  useAuditoriaRevisiones,
  revisionKey,
} from "@/hooks/auditoria/useAuditoriaRevisiones";
import { useAuth } from "@/contexts/AuthContext";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export type FiltroRevision = "todos" | "pendientes" | "revisados" | "en_progreso";
export type FiltroResponsable = "todos" | "mios" | "sin_asignar" | "vencidos";

export interface UseHallazgosTablaStateOptions {
  /** Severidad inicial (drill-down desde KPIs ejecutivos). */
  initialSeveridad?: SeveridadAuditoria | "todas";
  /** Cliente inicial (drill-down). */
  initialCliente?: string;
  /** Texto inicial de búsqueda (drill-down por estado/etapa, etc.). */
  initialSearch?: string;
  /** Si es true, sólo muestra hallazgos cuya ETA ya pasó (drill-down "vencidos"). */
  soloVencidos?: boolean;
  /** Filtro inicial por responsable (drill-down "mis pendientes"). */
  initialResponsable?: FiltroResponsable;
}

export function useHallazgosTablaState(
  hallazgos: HallazgoAuditoria[],
  mostrarRevisadosDefault = false,
  opts: UseHallazgosTablaStateOptions = {},
) {
  const defaultRevision: FiltroRevision = mostrarRevisadosDefault
    ? "todos"
    : "pendientes";

  const [search, setSearch] = useState(opts.initialSearch ?? "");
  const [filtroRegla, setFiltroRegla] = useState<ReglaAuditoria | "todas">("todas");
  const [filtroSev, setFiltroSev] = useState<SeveridadAuditoria | "todas">(
    opts.initialSeveridad ?? "todas",
  );
  const [filtroCliente, setFiltroCliente] = useState<string>(opts.initialCliente ?? "todos");
  const [filtroRevision, setFiltroRevision] = useState<FiltroRevision>(defaultRevision);
  const [filtroResponsable, setFiltroResponsable] = useState<FiltroResponsable>(
    opts.initialResponsable ?? "todos",
  );
  const [etaDesde, setEtaDesde] = useState<Date | undefined>();
  const [etaHasta, setEtaHasta] = useState<Date | undefined>(
    opts.soloVencidos ? new Date() : undefined,
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { user } = useAuth();
  const { data: revisiones } = useAuditoriaRevisiones();

  const clientes = useMemo(() => {
    const set = new Set(
      hallazgos.map((h) => h.cliente_nombre).filter((c): c is string => !!c),
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es-MX"));
  }, [hallazgos]);

  const filtrados = useMemo(() => {
    const ctx = {
      q: search.trim().toLowerCase(),
      desde: etaDesde ? etaDesde.toISOString().slice(0, 10) : null,
      hasta: etaHasta ? etaHasta.toISOString().slice(0, 10) : null,
      today: new Date().toISOString().slice(0, 10),
      filtroRegla, filtroSev, filtroCliente, filtroRevision, filtroResponsable,
      userId: user?.id,
      revisiones,
    };
    return hallazgos.filter((h) => matchHallazgo(h, ctx));
  }, [hallazgos, search, filtroRegla, filtroSev, filtroCliente, etaDesde, etaHasta, filtroRevision, filtroResponsable, revisiones, user?.id]);

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
    setFiltroResponsable("todos");
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
      filtroResponsable !== "todos" ||
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
    filtroResponsable,
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
    setFiltroResponsable: wrap(setFiltroResponsable),
    setEtaDesde: wrap(setEtaDesde),
    setEtaHasta: wrap(setEtaHasta),
    setPageSize: wrap(setPageSize),
    setPage,
    limpiar,
  };
}
