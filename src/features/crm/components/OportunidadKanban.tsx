/**
 * OportunidadKanban — vista Kanban con drag & drop entre etapas.
 * Muestra la próxima actividad pendiente por oportunidad.
 */
import { useMemo } from "react";
import {
  DndContext, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, type DragEndEvent,
} from "@dnd-kit/core";
import { Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { useProximasActividades, type ProximaActividad } from "@/features/crm/hooks";

const fmtMxn = (n: number) => formatCurrencyCompact(n, "MXN");
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import type { CrmEtapaRow } from "@/features/crm/hooks";

interface Props {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
  onMover: (oportunidadId: string, etapaId: string, probDefault: number) => void;
  onClickCard: (id: string) => void;
}

function formatProx(prox: ProximaActividad | undefined): string {
  if (!prox) return "Sin próxima acción";
  if (!prox.fecha_programada) return prox.asunto;
  const d = new Date(prox.fecha_programada);
  const hoy = new Date();
  const diff = Math.floor((d.getTime() - hoy.getTime()) / 86_400_000);
  if (diff < 0) return `Vencida · ${prox.asunto}`;
  if (diff === 0) return `Hoy · ${prox.asunto}`;
  if (diff === 1) return `Mañana · ${prox.asunto}`;
  return `${formatFechaEs(prox.fecha_programada)} · ${prox.asunto}`;
}

function OpCard({ op, onClick, proxima }: { op: CrmOportunidadRow; onClick: () => void; proxima?: ProximaActividad }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: op.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };
  const vencida = proxima?.fecha_programada && new Date(proxima.fecha_programada) < new Date();
  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className="bg-card border border-border hover:border-primary/50 transition-colors"
    >
      <CardContent className="p-3 space-y-1">
        <div className="font-medium text-sm line-clamp-2">{op.nombre}</div>
        {op.cliente_nombre ? (
          <div className="text-xs text-muted-foreground line-clamp-1">{op.cliente_nombre}</div>
        ) : null}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs font-semibold">{fmtMxn(Number(op.monto_estimado ?? 0))}</span>
          <Badge variant="secondary" className="text-2xs h-5 px-1.5">{op.probabilidad}%</Badge>
        </div>
        <div className={`text-2xs flex items-center gap-1 truncate pt-1 border-t border-border/40 mt-1 ${vencida ? "text-destructive" : "text-muted-foreground"}`}>
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatProx(proxima)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function Columna({
  etapa, ops, onClickCard, proximasMap,
}: {
  etapa: CrmEtapaRow;
  ops: CrmOportunidadRow[];
  onClickCard: (id: string) => void;
  proximasMap: Map<string, ProximaActividad>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const total = ops.reduce((s, o) => s + Number(o.monto_estimado ?? 0), 0);
  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/40 rounded-lg">
      <div
        className="p-3 border-b border-border flex items-center justify-between rounded-t-lg"
        style={{ borderTop: `3px solid ${etapa.color}` }}
      >
        <div>
          <div className="font-semibold text-sm">{etapa.nombre}</div>
          <div className="text-xs text-muted-foreground">{ops.length} · {fmtMxn(total)}</div>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-48 transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {ops.map((op) => (
          <OpCard key={op.id} op={op} onClick={() => onClickCard(op.id)} proxima={proximasMap.get(op.id)} />
        ))}
        {ops.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Sin oportunidades</div>
        )}
      </div>
    </div>
  );
}

export default function OportunidadKanban({ etapas, oportunidades, onMover, onClickCard }: Props) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const ids = useMemo(() => oportunidades.map((o) => o.id), [oportunidades]);
  const { data: proximasMap } = useProximasActividades("oportunidad", ids);

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
    const etapa = etapas.find((e) => e.id === etapaId);
    if (!op || !etapa || op.etapa_id === etapaId) return;
    onMover(oportunidadId, etapaId, etapa.probabilidad_default);
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-3">
        {etapas.map((e) => (
          <Columna
            key={e.id}
            etapa={e}
            ops={porEtapa.get(e.id) ?? []}
            onClickCard={onClickCard}
            proximasMap={proximasMap ?? new Map()}
          />
        ))}
      </div>
    </DndContext>
  );
}
