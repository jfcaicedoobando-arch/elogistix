/**
 * Orquesta el movimiento de etapa en el Kanban de oportunidades:
 * probabilidad heredada vs manual (B-054), cierre real al ganar (B-034),
 * toast con Undo y prompt de "Próximo paso" al mover a una etapa abierta.
 *
 * Extraído de `routes/Oportunidades.tsx` en 13.358.0 (Power of 10).
 */
import { useCallback, useState } from "react";
import { notifyError } from "@/lib/ui/appFeedback";
import { todayLocalISO } from "@/lib/date/today";
import {
  useMoverEtapaConAutomatizacion,
  type CrmEtapaRow,
  type CrmOportunidadRow,
} from "@/features/crm/hooks";

export interface ProximoPasoTarget {
  id: string;
  nombre: string;
}

interface Params {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
}

/**
 * B-054: no pisar una probabilidad editada manualmente. Heurística: si la
 * probabilidad difiere del default de la etapa ORIGEN se asume manual.
 */
function resolverProbabilidad(
  op: CrmOportunidadRow | undefined,
  etapaOrigen: CrmEtapaRow | undefined,
  probDestinoDefault: number,
): number {
  if (!op || !etapaOrigen) return probDestinoDefault;
  const esManual =
    Number(op.probabilidad ?? 0) !== Number(etapaOrigen.probabilidad_default ?? 0);
  return esManual ? Number(op.probabilidad ?? 0) : probDestinoDefault;
}

/** B-034: soltar en etapa "ganada" captura el cierre real con defaults. */
function resolverCierreGanada(
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
async function avisarCriteriosPendientes(
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

export interface PerdidaPendiente {
  id: string;
  nombre: string;
  etapaId: string;
  prob: number;
}

export function useMoverOportunidadEtapa({ etapas, oportunidades }: Params) {

  const mover = useMoverEtapaConAutomatizacion();
  const [proximoPaso, setProximoPaso] = useState<ProximoPasoTarget | null>(null);
  // Ola A: mover a una etapa "perdida" exige motivo (la BD lo valida también).
  const [perdidaPendiente, setPerdidaPendiente] = useState<PerdidaPendiente | null>(null);

  const ejecutarMover = useCallback(
    async (id: string, etapaId: string, prob: number, motivoPerdidaId?: string | null) => {
      const op = oportunidades.find((o) => o.id === id);
      const etapaPrev = op?.etapa_id;
      const probPrev = Number(op?.probabilidad ?? 0);
      const etapaOrigen = etapas.find((e) => e.id === etapaPrev);
      const etapaDestino = etapas.find((e) => e.id === etapaId) as
        | (CrmEtapaRow & { tipo?: string })
        | undefined;
      const probabilidad = resolverProbabilidad(op, etapaOrigen, prob);

      // Disciplina de pipeline: avisar (sin bloquear) si la etapa de origen
      // deja criterios de salida pendientes.
      await avisarCriteriosPendientes(id, etapaOrigen?.nombre);

      try {
        await mover.mutateAsync({
          id,
          etapa_id: etapaId,
          probabilidad,
          ...resolverCierreGanada(etapaDestino, op),
          // Ola 4 · N49: limpiar cierre real / motivo al salir de ganada/perdida.
          ...resolverLimpiezaCierre(etapaDestino, etapaOrigen),
          ...(motivoPerdidaId ? { motivo_perdida_id: motivoPerdidaId } : {}),
        });
        const { showUndoToast } = await import("@/features/crm/hooks/useUndoToast");
        showUndoToast("Etapa actualizada", async () => {
          if (!etapaPrev) return;
          // Ola 4 · N49: el Undo aplica la misma limpieza con origen/destino
          // invertidos (p. ej. deshacer abierta→ganada limpia el cierre real
          // que resolverCierreGanada acababa de escribir).
          await mover.mutateAsync({
            id,
            etapa_id: etapaPrev,
            probabilidad: probPrev,
            ...resolverLimpiezaCierre(etapaOrigen, etapaDestino),
          });
        });
        // Disciplina de pipeline: al avanzar a una etapa ABIERTA se pide el
        // próximo paso (ninguna oportunidad viva sin siguiente acción).
        if (etapaDestino?.tipo === "abierta" && op) {
          setProximoPaso({ id, nombre: op.nombre });
        }
      } catch (e) {
        notifyError(undefined, {
          title: "No se pudo mover",
          description: e instanceof Error ? e.message : undefined,
          error: e,
          method: "HANDLE_MOVER",
        });
      }
    },
    [etapas, oportunidades, mover],
  );

  const handleMover = useCallback(
    async (id: string, etapaId: string, prob: number) => {
      const etapaDestino = etapas.find((e) => e.id === etapaId) as
        | (CrmEtapaRow & { tipo?: string })
        | undefined;
      const op = oportunidades.find((o) => o.id === id);
      if (etapaDestino?.tipo === "perdida") {
        setPerdidaPendiente({ id, nombre: op?.nombre ?? "la oportunidad", etapaId, prob });
        return;
      }
      await ejecutarMover(id, etapaId, prob);
    },
    [etapas, oportunidades, ejecutarMover],
  );

  const confirmarPerdida = useCallback(
    async (motivoPerdidaId: string) => {
      const p = perdidaPendiente;
      if (!p) return;
      setPerdidaPendiente(null);
      await ejecutarMover(p.id, p.etapaId, p.prob, motivoPerdidaId);
    },
    [perdidaPendiente, ejecutarMover],
  );

  return {
    handleMover,
    proximoPaso,
    cerrarProximoPaso: () => setProximoPaso(null),
    perdidaPendiente,
    cerrarPerdida: () => setPerdidaPendiente(null),
    confirmarPerdida,
    moviendo: mover.isPending,
  };
}

