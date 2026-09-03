/**
 * OportunidadKanban — vista Kanban con drag & drop entre etapas.
 * Muestra próxima actividad, avance de criterios de salida y metas por oportunidad.
 * Tarjeta y columna viven en `kanban/` para respetar el límite de tamaño.
 */
import { useMemo } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors, type DragEndEvent,
} from "@dnd-kit/core";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useProximasActividades, type ProximaActividad } from "@/features/crm/hooks";
import { useAvanceCriterios } from "@/features/crm/hooks/useCriteriosEtapa";
import ColumnaEtapa from "./kanban/ColumnaEtapa";
import PipelineResumen from "./kanban/PipelineResumen";
import type { CrmOportunidadRow, CrmEtapaRow } from "@/features/crm/hooks";

/**
 * Ola 3 · O3.7.4 — carril sintético para oportunidades cuya `etapa_id` es
 * nula o apunta a una etapa inexistente (antes desaparecían del tablero).
 * No es un destino de drag válido: `handleDragEnd` sólo acepta etapas reales.
 */
const ETAPA_SIN_ETAPA: CrmEtapaRow = {
  id: "__sin_etapa__",
  nombre: "Sin etapa",
  color: "hsl(var(--muted-foreground))",
  tipo: "abierta",
  orden: -1,
  activa: true,
  crea_tarea_seguimiento: false,
  created_at: "",
  deleted_at: null,
  deleted_by: null,
  dias_seguimiento: 0,
  organization_id: "",
  probabilidad_default: 0,
  sla_dias: null,
  updated_at: "",
};

interface Props {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
  onMover: (oportunidadId: string, etapaId: string, probDefault: number) => void;
  onClickCard: (id: string) => void;
  /** CTA del estado vacío de cada columna (E-11). Omitir oculta la acción. */
  onNuevo?: () => void;
  /**
   * Permiso real de mover UNA oportunidad de etapa (espejo de las policies de
   * `crm_oportunidades`: staff sobre cualquiera, vendedor sólo las propias).
   * Cuando devuelve `false` no hay drag ni handler activo para esa tarjeta.
   */
  puedeMover?: (op: CrmOportunidadRow) => boolean;
}

export default function OportunidadKanban({ etapas, oportunidades, onMover, onClickCard, onNuevo, puedeMover }: Props) {
  const puedeMoverOp = (op: CrmOportunidadRow) => (puedeMover ? puedeMover(op) : true);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => oportunidades.map((o) => o.id), [oportunidades]);
  const { data: proximasMap } = useProximasActividades("oportunidad", ids);
  const { data: avanceMap } = useAvanceCriterios(ids);

  const { porEtapa, huerfanas } = useMemo(() => {
    const m = new Map<string, CrmOportunidadRow[]>();
    for (const e of etapas) m.set(e.id, []);
    const sinEtapa: CrmOportunidadRow[] = [];
    for (const o of oportunidades) {
      const arr = m.get(o.etapa_id);
      if (arr) arr.push(o);
      else sinEtapa.push(o);
    }
    return { porEtapa: m, huerfanas: sinEtapa };
  }, [etapas, oportunidades]);

  const handleDragEnd = (e: DragEndEvent) => {
    const oportunidadId = String(e.active.id);
    const etapaId = e.over ? String(e.over.id) : null;
    if (!etapaId) return;
    const op = oportunidades.find((o) => o.id === oportunidadId);
    const etapa = etapas.find((x) => x.id === etapaId);
    if (!op || !etapa || op.etapa_id === etapaId) return;
    if (!puedeMoverOp(op)) return;
    onMover(oportunidadId, etapaId, etapa.probabilidad_default);
  };

  const proximas: Map<string, ProximaActividad> = proximasMap ?? new Map();

  return (
    <div className="space-y-3">
      <PipelineResumen oportunidades={oportunidades} />
      {huerfanas.length > 0 && (
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" aria-hidden />
          <AlertTitle>Oportunidades sin etapa</AlertTitle>
          <AlertDescription>
            {huerfanas.length === 1
              ? "1 oportunidad no tiene etapa asignada; arrástrala a una etapa del pipeline o asígnala desde su detalle."
              : `${huerfanas.length} oportunidades no tienen etapa asignada; arrástralas a una etapa del pipeline o asígnalas desde su detalle.`}
          </AlertDescription>
        </Alert>
      )}
      {/* E-3: contenedor relativo con máscara de degradado a la derecha para
          señalar que hay más columnas fuera de la vista (p. ej. "Ganada"). */}
      <div className="relative">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-3 items-start snap-x">
            {huerfanas.length > 0 && (
              <ColumnaEtapa
                etapa={ETAPA_SIN_ETAPA}
                ops={huerfanas}
                onClickCard={onClickCard}
                proximasMap={proximas}
                avanceMap={avanceMap ?? new Map()}
                puedeArrastrar={puedeMoverOp}
              />
            )}
            {etapas.map((e) => (
              <ColumnaEtapa
                key={e.id}
                etapa={e}
                ops={porEtapa.get(e.id) ?? []}
                onClickCard={onClickCard}
                proximasMap={proximas}
                avanceMap={avanceMap ?? new Map()}
                onNuevo={onNuevo}
                puedeArrastrar={puedeMoverOp}
              />
            ))}
          </div>
        </DndContext>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-background to-transparent"
        />
      </div>
    </div>
  );
}
