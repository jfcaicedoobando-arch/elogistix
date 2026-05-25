/**
 * OportunidadKanban — vista Kanban con drag & drop entre etapas.
 */
import { useMemo } from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrencyCompact } from "@/lib/formatters";

const fmtMxn = (n: number) => formatCurrencyCompact(n, "MXN");
import type { CrmOportunidadRow } from "@/hooks/crm/useOportunidades";
import type { CrmEtapaRow } from "@/hooks/crm/useEtapasPipeline";

interface Props {
  etapas: CrmEtapaRow[];
  oportunidades: CrmOportunidadRow[];
  onMover: (oportunidadId: string, etapaId: string, probDefault: number) => void;
  onClickCard: (id: string) => void;
}

function OpCard({ op, onClick }: { op: CrmOportunidadRow; onClick: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: op.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };
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
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">{op.probabilidad}%</Badge>
        </div>
        {op.vendedor_email ? (
          <div className="text-[10px] text-muted-foreground truncate">{op.vendedor_email}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Columna({
  etapa,
  ops,
  onClickCard,
}: {
  etapa: CrmEtapaRow;
  ops: CrmOportunidadRow[];
  onClickCard: (id: string) => void;
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
        className={`flex-1 p-2 space-y-2 min-h-[200px] transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {ops.map((op) => (
          <OpCard key={op.id} op={op} onClick={() => onClickCard(op.id)} />
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
          <Columna key={e.id} etapa={e} ops={porEtapa.get(e.id) ?? []} onClickCard={onClickCard} />
        ))}
      </div>
    </DndContext>
  );
}
