/**
 * Predicados puros de filtrado para hallazgos de auditoría.
 * Extraídos de useHallazgosTablaState para mantener archivos ≤200 LOC y
 * permitir tests aislados.
 */
import { revisionKey } from "@/hooks/auditoria/useAuditoriaRevisiones";
import type {
  HallazgoAuditoria,
  ReglaAuditoria,
  SeveridadAuditoria,
} from "@/types/auditoria";

export type FiltroRevision = "todos" | "pendientes" | "revisados" | "en_progreso";
export type FiltroResponsable = "todos" | "mios" | "sin_asignar" | "vencidos";

export interface MatchCtx {
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
  revisiones:
    | Map<string, { estado_revision?: string; responsable_id?: string | null; fecha_limite?: string | null }>
    | undefined;
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
  switch (filtro) {
    case "todos": return true;
    case "revisados": return estado === "revisado";
    case "en_progreso": return estado === "en_progreso";
    case "pendientes": return !(tieneRev && estado === "revisado");
    default: {
      // Exhaustiveness check: añadir un nuevo FiltroRevision sin manejarlo aquí
      // dispara un error de tipos en compile time.
      const _exhaustive: never = filtro;
      return _exhaustive;
    }
  }
}

function matchResponsable(
  rev: { responsable_id?: string | null; fecha_limite?: string | null } | null,
  estado: string,
  filtro: FiltroResponsable,
  userId: string | undefined,
  today: string,
): boolean {
  switch (filtro) {
    case "todos": return true;
    case "mios": return rev?.responsable_id === userId;
    case "sin_asignar": return !rev?.responsable_id;
    case "vencidos": {
      if (!rev?.fecha_limite) return false;
      if (rev.fecha_limite >= today) return false;
      if (estado === "revisado") return false;
      return true;
    }
    default: {
      const _exhaustive: never = filtro;
      return _exhaustive;
    }
  }
}

export function matchHallazgo(h: HallazgoAuditoria, c: MatchCtx): boolean {
  if (!matchBase(h, c)) return false;
  const rev = c.revisiones?.get(revisionKey(h)) ?? null;
  const estado = rev?.estado_revision ?? "pendiente";
  if (!matchRevision(estado, !!rev, c.filtroRevision)) return false;
  if (!matchResponsable(rev, estado, c.filtroResponsable, c.userId, c.today)) return false;
  return true;
}
