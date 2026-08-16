/**
 * Tarjeta de oportunidad del Kanban: monto, probabilidad, próxima acción,
 * avance de criterios de salida y meta de monto/fecha.
 */
import { useDraggable } from "@dnd-kit/core";
import { Calendar, CheckCircle2, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrencyCompact } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters/dates";
import { todayLocalISO } from "@/lib/date/today";
import {
  estadoMeta, porcentajeCriterios, semaforoCriterios, type AvanceCriterios,
} from "@/features/crm/domain/criterios";
import type { ProximaActividad } from "@/features/crm/hooks";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

const fmtMxn = (n: number) => formatCurrencyCompact(n, "MXN");

export function formatProx(prox: ProximaActividad | undefined): string {
  if (!prox) return "Sin próxima acción";
  if (!prox.fecha_programada) return prox.asunto;
  const d = new Date(prox.fecha_programada);
  const diff = Math.floor((d.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return `Vencida · ${prox.asunto}`;
  if (diff === 0) return `Hoy · ${prox.asunto}`;
  if (diff === 1) return `Mañana · ${prox.asunto}`;
  return `${formatFechaEs(prox.fecha_programada)} · ${prox.asunto}`;
}

interface Props {
  op: CrmOportunidadRow;
  onClick: () => void;
  proxima?: ProximaActividad;
  avance?: AvanceCriterios;
  esCerrada: boolean;
}

export default function OportunidadCard({ op, onClick, proxima, avance, esCerrada }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: op.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: "grab",
  };
  const vencida = proxima?.fecha_programada && new Date(proxima.fecha_programada) < new Date();
  const semaforo = semaforoCriterios(avance);
  const meta = estadoMeta(
    {
      montoEstimado: Number(op.monto_estimado ?? 0),
      montoMeta: op.monto_meta != null ? Number(op.monto_meta) : null,
      fechaMetaCierre: op.fecha_meta_cierre ?? null,
      cerrada: esCerrada,
    },
    todayLocalISO(),
  );

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

        {semaforo !== "sin_criterios" && avance ? (
          <div className="flex items-center gap-2 pt-1">
            <Progress value={porcentajeCriterios(avance) * 100} className="h-1.5 flex-1" />
            <span
              className={`text-2xs flex items-center gap-1 ${
                semaforo === "completo" ? "text-success" : "text-warning"
              }`}
            >
              {semaforo === "completo" ? <CheckCircle2 className="h-3 w-3" /> : null}
              {avance.cumplidos}/{avance.total}
            </span>
          </div>
        ) : null}

        {meta.tieneMeta ? (
          <div
            className={`text-2xs flex items-center gap-1 ${
              meta.metaVencida ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <Target className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {op.fecha_meta_cierre ? `Meta ${formatFechaEs(op.fecha_meta_cierre)}` : "Meta"}
              {meta.avance != null ? ` · ${Math.round(meta.avance * 100)}% de ${fmtMxn(Number(op.monto_meta ?? 0))}` : ""}
              {meta.metaVencida ? " · vencida" : ""}
            </span>
          </div>
        ) : null}

        <div
          className={`text-2xs flex items-center gap-1 truncate pt-1 border-t border-border/40 mt-1 ${
            vencida ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Calendar className="h-3 w-3 shrink-0" />
          <span className="truncate">{formatProx(proxima)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
