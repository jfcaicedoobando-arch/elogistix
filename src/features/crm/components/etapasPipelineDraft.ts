/**
 * Merge de borradores del editor de etapas (v13.823.104).
 *
 * Un refetch posterior a guardar una fila no debe borrar los cambios sin
 * guardar de otras filas: se conserva el borrador local de cada fila sucia,
 * se rehidratan sólo las filas limpias y se descartan borradores de filas
 * que ya no existen. No altera orden ni datos enviados al backend.
 */
import { COLOR_ETAPA_DEFAULT } from "@/lib/chartTokens";
import type { CrmEtapaRow, CrmEtapaTipo } from "@/features/crm/hooks";

export interface RowState {
  nombre: string; tipo: CrmEtapaTipo; color: string;
  probabilidad_default: number; orden: number; activa: boolean;
  crea_tarea_seguimiento: boolean; dias_seguimiento: number; sla_dias: number;
}

export function toState(e: CrmEtapaRow): RowState {
  return {
    nombre: e.nombre, tipo: e.tipo as CrmEtapaTipo, color: e.color ?? COLOR_ETAPA_DEFAULT,
    probabilidad_default: e.probabilidad_default ?? 0,
    orden: e.orden, activa: e.activa,
    crea_tarea_seguimiento: e.crea_tarea_seguimiento ?? false,
    dias_seguimiento: e.dias_seguimiento ?? 3,
    sla_dias: e.sla_dias ?? 7,
  };
}

export function sameState(a: RowState, b: RowState): boolean {
  return (
    a.nombre === b.nombre && a.tipo === b.tipo && a.color === b.color &&
    a.probabilidad_default === b.probabilidad_default && a.orden === b.orden &&
    a.activa === b.activa &&
    a.crea_tarea_seguimiento === b.crea_tarea_seguimiento &&
    a.dias_seguimiento === b.dias_seguimiento && a.sla_dias === b.sla_dias
  );
}

/**
 * @param prevDraft borrador actual en memoria
 * @param prevServer snapshot del backend con el que se hidrató ese borrador
 * @param etapas filas frescas del backend (orden intacto)
 */
export function mergeDrafts(
  prevDraft: Record<string, RowState>,
  prevServer: Record<string, RowState>,
  etapas: CrmEtapaRow[],
): Record<string, RowState> {
  const next: Record<string, RowState> = {};
  for (const e of etapas) {
    const local = prevDraft[e.id];
    const base = prevServer[e.id];
    const server = toState(e);
    // Fila sucia: conserva el borrador. Fila limpia o guardada: adopta backend.
    next[e.id] = local && base && !sameState(local, base) ? local : server;
  }
  return next;
}

export function serverSnapshot(etapas: CrmEtapaRow[]): Record<string, RowState> {
  return Object.fromEntries(etapas.map((e) => [e.id, toState(e)]));
}
