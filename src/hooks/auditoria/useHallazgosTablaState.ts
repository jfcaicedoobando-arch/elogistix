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

interface MatchCtx {
  q: string;
  desde: string | null;
  hasta: string | null;
  today: string;
  filtroRegla: ReglaAuditoria | "todas";
  filtroSev: SeveridadAuditoria | "todas";
  filtroCliente: string;
  filtroRevision: FiltroRevision;
  filtroResponsable: FiltroResponsable;
  userId: string | undefined;
  revisiones: Map<string, { estado_revision?: string; responsable_id?: string | null; fecha_limite?: string | null }> | undefined;
}

const BASE_PREDICATES: Array<(h: HallazgoAuditoria, c: MatchCtx) => boolean> = [
  (h, c) => !c.q || !!h.expediente?.toLowerCase().includes(c.q),
  (h, c) => c.filtroRegla === "todas" || h.regla === c.filtroRegla,
  (h, c) => c.filtroSev === "todas" || h.severidad === c.filtroSev,
  (h, c) => c.filtroCliente === "todos" || h.cliente_nombre === c.filtroCliente,
  (h, c) => !c.desde || (!!h.eta && h.eta >= c.desde),
  (h, c) => !c.hasta || (!!h.eta && h.eta <= c.hasta),
];

function matchBase(h: HallazgoAuditoria, c: MatchCtx): boolean {
  return BASE_PREDICATES.every((p) => p(h, c));
}

function matchRevision(estado: string, tieneRev: boolean, filtro: FiltroRevision): boolean {
  if (filtro === "todos") return true;
  if (filtro === "revisados") return estado === "revisado";
  if (filtro === "en_progreso") return estado === "en_progreso";
  if (filtro === "pendientes") return !(tieneRev && estado === "revisado");
  return true;
}

function matchResponsable(
  rev: { responsable_id?: string | null; fecha_limite?: string | null } | null,
  estado: string,
  filtro: FiltroResponsable,
  userId: string | undefined,
  today: string,
): boolean {
  if (filtro === "todos") return true;
  if (filtro === "mios") return rev?.responsable_id === userId;
  if (filtro === "sin_asignar") return !rev?.responsable_id;
  if (filtro === "vencidos") {
    if (!rev?.fecha_limite) return false;
    if (rev.fecha_limite >= today) return false;
    if (estado === "revisado") return false;
    return true;
  }
  return true;
}

function matchHallazgo(h: HallazgoAuditoria, c: MatchCtx): boolean {
  if (!matchBase(h, c)) return false;
  const rev = c.revisiones?.get(revisionKey(h)) ?? null;
  const estado = rev?.estado_revision ?? "pendiente";
  if (!matchRevision(estado, !!rev, c.filtroRevision)) return false;
  if (!matchResponsable(rev, estado, c.filtroResponsable, c.userId, c.today)) return false;
  return true;
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
