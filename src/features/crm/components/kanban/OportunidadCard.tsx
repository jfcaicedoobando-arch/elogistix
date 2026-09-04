/**
 * Tarjeta de oportunidad del Kanban: monto, probabilidad, próxima acción,
 * avance de criterios de salida y meta de monto/fecha.
 *
 * v13.629.1 — Las sub-filas viven en `OportunidadCard.parts.tsx`.
 */
import { useDraggable } from "@dnd-kit/core";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/shared/Hint";
import { formatCurrencyCompact } from "@/lib/formatters";
import { todayLocalISO } from "@/lib/date/today";
import { estadoMeta, semaforoCriterios, type AvanceCriterios } from "@/features/crm/domain/criterios";
import {
  CriteriosRow, MetaRow, ProximaRow,
} from "@/features/crm/components/kanban/OportunidadCard.parts";
import { formatProx } from "@/features/crm/domain/proximaActividadLabel";
import type { ProximaActividad } from "@/features/crm/hooks";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  op: CrmOportunidadRow;
  onClick: () => void;
  proxima?: ProximaActividad;
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

export default function OportunidadCard({ op, onClick, proxima, avance, esCerrada, arrastrable = true }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: op.id,
    disabled: !arrastrable,
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    cursor: arrastrable ? "grab" : "pointer",
  };
  const { vencida, montoEstimado, montoMeta, semaforo, meta } = derivarDatosTarjeta(
    op,
    proxima,
    avance,
    esCerrada,
  );

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...(arrastrable ? listeners : {})}
      {...(arrastrable ? attributes : {})}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        onClick();
      }}
      className="bg-card border border-border hover:border-primary/50 transition-colors"
    >
      <CardContent className="p-3 space-y-1">
        {/* E-14: nombre y cliente se truncan en tarjetas angostas; el texto
            completo queda disponible en un tooltip accesible. */}
        <Hint label={op.nombre}>
          <div className="font-medium text-body line-clamp-2">{op.nombre}</div>
        </Hint>
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

        <ProximaRow texto={formatProx(proxima)} vencida={vencida} />
      </CardContent>
    </Card>
  );
}
