/**
 * Helpers puros usados por `useMoverOportunidadEtapa` (extraídos en 13.358.x
 * para respetar el límite de 200 líneas por archivo — Power of 10).
 */
import { todayLocalISO } from "@/lib/date/today";
import type { CrmEtapaRow, CrmOportunidadRow } from "@/features/crm/hooks";

/**
 * B-054: no pisar una probabilidad editada manualmente. Heurística: si la
 * probabilidad difiere del default de la etapa ORIGEN se asume manual.
 *
 * v13.823.50 — las etapas terminales son la excepción: ganada siempre 100 y
 * perdida siempre 0, aunque hubiera probabilidad manual (antes una
 * oportunidad ganada podía quedar en 70%).
 */
export function resolverProbabilidad(
  op: CrmOportunidadRow | undefined,
  etapaOrigen: CrmEtapaRow | undefined,
  probDestinoDefault: number,
  etapaDestino?: (CrmEtapaRow & { tipo?: string }) | undefined,
): number {
  if (etapaDestino?.tipo === "ganada") return 100;
  if (etapaDestino?.tipo === "perdida") return 0;
  if (!op || !etapaOrigen) return probDestinoDefault;
  const esManual =
    Number(op.probabilidad ?? 0) !== Number(etapaOrigen.probabilidad_default ?? 0);
  return esManual ? Number(op.probabilidad ?? 0) : probDestinoDefault;
}


/** B-034: soltar en etapa "ganada" captura el cierre real con defaults. */
export function resolverCierreGanada(
  etapaDestino: (CrmEtapaRow & { tipo?: string }) | undefined,
  op: CrmOportunidadRow | undefined,
): { fecha_cierre_real?: string; valor_real?: number } {
  if (etapaDestino?.tipo !== "ganada") return {};
  return {
    fecha_cierre_real: todayLocalISO(),
    valor_real: Number(op?.monto_estimado ?? 0),
  };
}

/**
 * Ola 4 · N49: al SALIR de una etapa cerrada se limpian sus campos de cierre.
 * Antes una oportunidad devuelta de "ganada" a una etapa abierta conservaba
 * fecha_cierre_real/valor_real (y la de "perdida", su motivo) — dato
 * contradictorio con el formulario, que exige cierre sólo en etapas cerradas.
 */
export function resolverLimpiezaCierre(
  etapaDestino: (CrmEtapaRow & { tipo?: string }) | undefined,
  etapaOrigen: (CrmEtapaRow & { tipo?: string }) | undefined,
): { fecha_cierre_real?: null; valor_real?: null; motivo_perdida_id?: null } {
  const patch: { fecha_cierre_real?: null; valor_real?: null; motivo_perdida_id?: null } = {};
  if (etapaOrigen?.tipo === "ganada" && etapaDestino?.tipo !== "ganada") {
    patch.fecha_cierre_real = null;
    patch.valor_real = null;
  }
  if (etapaOrigen?.tipo === "perdida" && etapaDestino?.tipo !== "perdida") {
    patch.motivo_perdida_id = null;
  }
  return patch;
}

/** Avisa (sin bloquear) si la etapa de origen deja criterios pendientes. */
export async function avisarCriteriosPendientes(
  oportunidadId: string,
  etapaNombre: string | undefined,
): Promise<void> {
  if (!etapaNombre) return;
  try {
    const [{ fetchAvanceCriterios }, { avisoCriteriosPendientes }, { notifyWarning }] =
      await Promise.all([
        import("@/features/crm/services/criteriosEtapa"),
        import("@/features/crm/domain/criterios"),
        import("@/lib/ui/appFeedback"),
      ]);
    const mapa = await fetchAvanceCriterios([oportunidadId]);
    const aviso = avisoCriteriosPendientes(mapa.get(oportunidadId), etapaNombre);
    if (aviso) {
      notifyWarning(undefined, {
        title: aviso,
        description: "Puedes continuar, pero el avance de la etapa quedará incompleto.",
        method: "HANDLE_MOVER",
      });
    }
  } catch {
    // El aviso es informativo: nunca debe impedir mover la oportunidad.
  }
}

/**
 * v13.823.121 — ¿el destino ejecutará una tarea automática visible?
 * `runAutomatizaciones` crea "Generar cotización en firme" al ganar y
 * "Seguimiento: …" en etapas abiertas con `crea_tarea_seguimiento`. El Undo
 * sólo revierte la etapa, así que en esos casos no se ofrece (la tarea ya
 * creada contradiría la etapa anterior). No se borra ninguna actividad.
 */
export function destinoGeneraTareaAutomatica(
  etapaDestino: (CrmEtapaRow & { tipo?: string; crea_tarea_seguimiento?: boolean | null }) | undefined,
): boolean {
  if (!etapaDestino) return false;
  if (etapaDestino.tipo === "ganada") return true;
  return etapaDestino.tipo === "abierta" && etapaDestino.crea_tarea_seguimiento === true;
}

/**
 * v13.823.121 — ¿se puede ofrecer "Deshacer" al mover a este destino?
 * No, si el destino cancela actividades (perdida) o crea una tarea automática:
 * el Undo sólo revierte la etapa y dejaría el tablero inconsistente.
 */
export function puedeOfrecerUndo(
  etapaDestino: (CrmEtapaRow & { tipo?: string; crea_tarea_seguimiento?: boolean | null }) | undefined,
): boolean {
  if (etapaDestino?.tipo === "perdida") return false;
  return !destinoGeneraTareaAutomatica(etapaDestino);
}
