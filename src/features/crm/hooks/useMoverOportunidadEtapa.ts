/**
 * Orquesta el movimiento de etapa en el Kanban de oportunidades:
 * probabilidad heredada vs manual (B-054), cierre real al ganar (B-034),
 * toast con Undo y prompt de "Próximo paso" al mover a una etapa abierta.
 *
 * Extraído de `routes/Oportunidades.tsx` en 13.358.0 (Power of 10).
 * Los helpers puros viven en `moverOportunidadEtapaHelpers.ts`.
 */
import { useCallback, useState } from "react";
import {
  useMoverEtapaConAutomatizacion,
  type CrmEtapaRow,
  type CrmOportunidadRow,
} from "@/features/crm/hooks";
import {
  resolverProbabilidad,
  resolverCierreGanada,
  resolverLimpiezaCierre,
  avisarCriteriosPendientes,
  destinoGeneraTareaAutomatica,
} from "./moverOportunidadEtapaHelpers";

export { resolverLimpiezaCierre };

export interface ProximoPasoTarget {
  id: string;
  nombre: string;
}

interface Params {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
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
      const probabilidad = resolverProbabilidad(op, etapaOrigen, prob, etapaDestino);

      // Disciplina de pipeline: avisar (sin bloquear) si la etapa de origen
      // deja criterios de salida pendientes.
      await avisarCriteriosPendientes(id, etapaOrigen?.nombre);

      try {
        // Hallazgo 14: bloqueo optimista con el sello leído del listado
        // actual; capturamos el nuevo sello devuelto para que el Undo (que
        // manda su propio UPDATE inmediatamente después) no choque consigo
        // mismo.
        const resultado = await mover.mutateAsync({
          id,
          etapa_id: etapaId,
          probabilidad,
          ...resolverCierreGanada(etapaDestino, op),
          // Ola 4 · N49: limpiar cierre real / motivo al salir de ganada/perdida.
          ...resolverLimpiezaCierre(etapaDestino, etapaOrigen),
          ...(motivoPerdidaId ? { motivo_perdida_id: motivoPerdidaId } : {}),
          expectedUpdatedAt: op?.updated_at ?? null,
        });
        const selloTrasMover = (resultado as { updated_at?: string } | undefined)?.updated_at ?? null;
        // El destino "perdida" cancela/completa actividades pendientes: el Undo
        // no puede revivirlas, así que no se ofrece (evita Undo falso que dejaría
        // una oportunidad abierta con sus tareas canceladas).
        // v13.823.121 — tampoco se ofrece cuando el destino crea una tarea
        // automática (ganada, o abierta con crea_tarea_seguimiento): el Undo
        // sólo devuelve la etapa y la tarea quedaría contradiciéndola.
        if (etapaDestino?.tipo !== "perdida" && !destinoGeneraTareaAutomatica(etapaDestino)) {
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
              expectedUpdatedAt: selloTrasMover,
            });
          });
        }
        // Disciplina de pipeline: al avanzar a una etapa ABIERTA se pide el
        // próximo paso (ninguna oportunidad viva sin siguiente acción).
        if (etapaDestino?.tipo === "abierta" && op) {
          setProximoPaso({ id, nombre: op.nombre });
        }
      } catch {
        // v13.823.49 — el error ya lo notifica `useMoverEtapaConAutomatizacion`;
        // un segundo toast aquí duplicaba el aviso.
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
