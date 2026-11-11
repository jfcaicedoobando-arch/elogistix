/**
 * Tarjeta de oportunidad del Kanban: monto, probabilidad, próxima acción,
 * avance de criterios de salida y meta de monto/fecha.
 *
 * v13.629.1 — Las sub-filas viven en `OportunidadCard.parts.tsx`.
 */
import { memo } from "react";
import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { formatCurrencyCompact } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { estadoMeta, semaforoCriterios, type AvanceCriterios } from "@/features/crm/domain/criterios";
import {
  CriteriosRow, MetaRow, ProximaRow,
} from "@/features/crm/components/kanban/OportunidadCard.parts";
import { formatProx, type EstadoProximas } from "@/features/crm/domain/proximaActividadLabel";
import type { ProximaActividad } from "@/features/crm/hooks";
import type { CrmOportunidadRow } from "@/features/crm/hooks";
import { EtiquetaEmpresaEliminada } from "@/features/crm/components/objetos/EtiquetaEmpresaEliminada";
import { EtiquetaSolicitudRespondida } from "@/features/crm/components/objetos/EtiquetaSolicitudRespondida";

interface Props {
  op: CrmOportunidadRow;
  onClick: () => void;
  proxima?: ProximaActividad;
  estadoProximas?: EstadoProximas;
  avance?: AvanceCriterios;
  esCerrada: boolean;
  /**
   * Permiso real de mover la oportunidad de etapa. Con `false` el drag queda
   * DESHABILITADO (no sólo oculto): la RLS rechazaría el guardado.
   */
  arrastrable?: boolean;
}

/**
 * Datos derivados de la tarjeta (montos, meta y semáforo). Se calculan aparte
 * para mantener el componente bajo el límite de complejidad del lint.
 */
function derivarDatosTarjeta(
  op: Props["op"],
  proxima: Props["proxima"],
  avance: Props["avance"],
  esCerrada: Props["esCerrada"],
) {
  const vencida = Boolean(
    proxima?.fecha_programada && new Date(proxima.fecha_programada) < new Date(),
  );
  const montoEstimado = Number(op.monto_estimado ?? 0);
  const meta = estadoMeta(
    {
      montoEstimado,
      montoMeta: op.monto_meta != null ? Number(op.monto_meta) : null,
      fechaMetaCierre: op.fecha_meta_cierre ?? null,
      cerrada: esCerrada,
    },
    todayLocalISO(),
  );
  return {
    vencida,
    montoEstimado,
    montoMeta: Number(op.monto_meta ?? 0),
    semaforo: semaforoCriterios(avance),
    meta,
  };
}

export default function OportunidadCard({ op, onClick, proxima, estadoProximas = "listo", avance, esCerrada, arrastrable = true }: Props) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({
    id: op.id,
    disabled: !arrastrable,
    data: { nombre: op.nombre },
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: "pointer",
  };
  return (
    <Card
      ref={setNodeRef}
      style={style}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className="relative bg-card border border-border hover:border-primary/50 transition-colors"
    >
      {arrastrable && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Mover ${op.nombre} de etapa`}
          onClick={(event) => event.stopPropagation()}
          className="absolute right-1 top-1 z-10 flex h-9 w-9 touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
        >
          <GripVertical className="h-4 w-4" aria-hidden />
        </button>
      )}
      <ContenidoTarjeta op={op} proxima={proxima} estadoProximas={estadoProximas} avance={avance} esCerrada={esCerrada} onOpen={onClick} arrastrable={arrastrable} />
    </Card>
  );
}

const ContenidoTarjeta = memo(function ContenidoTarjeta({
  op, proxima, estadoProximas = "listo", avance, esCerrada, arrastrable, onOpen,
}: Pick<Props, "op" | "proxima" | "estadoProximas" | "avance" | "esCerrada" | "arrastrable"> & { onOpen: () => void }) {
  const { vencida, montoEstimado, montoMeta, semaforo, meta } =
    derivarDatosTarjeta(op, proxima, avance, esCerrada);
  return (
    <CardContent className="p-3 space-y-1">
      {/* E-14: nombre y cliente se truncan en tarjetas angostas; el texto
          completo queda disponible en un tooltip accesible. */}
      <Hint label={op.nombre}>
        <button
          type="button"
          aria-label={`Ver oportunidad ${op.nombre}`}
          onClick={(event) => { event.stopPropagation(); onOpen(); }}
          className={`rounded-sm text-left font-medium text-body line-clamp-2 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${arrastrable ? "pr-8" : ""}`}
        >{op.nombre}</button>
      </Hint>
      <EtiquetaEmpresaEliminada oportunidadId={op.id} />
      <EtiquetaSolicitudRespondida oportunidadId={op.id} />
      {op.cliente_nombre ? (
        <Hint label={op.cliente_nombre}>
          <div className="text-body-sm text-muted-foreground line-clamp-1">{op.cliente_nombre}</div>
        </Hint>
      ) : null}
      <div className="flex items-center justify-between pt-1">
        <span className="text-body-sm font-semibold">{formatCurrencyCompact(montoEstimado, op.moneda)}</span>
        <Badge variant="secondary" className="text-label h-5 px-1.5">{op.probabilidad}%</Badge>
      </div>

      {semaforo !== "sin_criterios" && avance ? (
        <CriteriosRow avance={avance} completo={semaforo === "completo"} />
      ) : null}

      {meta.tieneMeta ? (
        <MetaRow
          vencida={Boolean(meta.metaVencida)}
          fechaMeta={op.fecha_meta_cierre ?? null}
          avance={meta.avance ?? null}
          montoMeta={montoMeta}
          moneda={op.moneda}
        />
      ) : null}

      <ProximaRow
        texto={formatProx(proxima, estadoProximas)}
        vencida={vencida}
      />
    </CardContent>
  );
});
