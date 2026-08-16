/**
 * OportunidadKanban — vista Kanban con drag & drop entre etapas.
 * Muestra próxima actividad, avance de criterios de salida y metas por oportunidad.
 * Tarjeta y columna viven en `kanban/` para respetar el límite de tamaño.
 */
import { useMemo } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { useProximasActividades, type ProximaActividad } from "@/features/crm/hooks";
import { useAvanceCriterios } from "@/features/crm/hooks/useCriteriosEtapa";
import ColumnaEtapa from "./kanban/ColumnaEtapa";
import PipelineResumen from "./kanban/PipelineResumen";
import type { CrmOportunidadRow, CrmEtapaRow } from "@/features/crm/hooks";

interface Props {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
  onMover: (oportunidadId: string, etapaId: string, probDefault: number) => void;
  onClickCard: (id: string) => void;
}

export default function OportunidadKanban({ etapas, oportunidades, onMover, onClickCard }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => oportunidades.map((o) => o.id), [oportunidades]);
  const { data: proximasMap } = useProximasActividades("oportunidad", ids);
  const { data: avanceMap } = useAvanceCriterios(ids);

  const porEtapa = useMemo(() => {
    const m = new Map<string, CrmOportunidadRow[]>();
    for (const e of etapas) m.set(e.id, []);
    for (const o of oportunidades) {
      const arr = m.get(o.etapa_id);
      if (arr) arr.push(o);
    }
    return m;
  }, [etapas, oportunidades]);

  const handleDragEnd = (e: DragEndEvent) => {
    const oportunidadId = String(e.active.id);
    const etapaId = e.over ? String(e.over.id) : null;
    if (!etapaId) return;
    const op = oportunidades.find((o) => o.id === oportunidadId);
    const etapa = etapas.find((x) => x.id === etapaId);
    if (!op || !etapa || op.etapa_id === etapaId) return;
    onMover(oportunidadId, etapaId, etapa.probabilidad_default);
  };

  const proximas: Map<string, ProximaActividad> = proximasMap ?? new Map();

  return (
    <div className="space-y-3">
      <PipelineResumen oportunidades={oportunidades} />
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-3">
          {etapas.map((e) => (
            <ColumnaEtapa
              key={e.id}
              etapa={e}
              ops={porEtapa.get(e.id) ?? []}
              onClickCard={onClickCard}
              proximasMap={proximas}
              avanceMap={avanceMap ?? new Map()}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}
