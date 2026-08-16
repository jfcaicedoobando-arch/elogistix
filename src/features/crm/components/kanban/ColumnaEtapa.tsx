/**
 * Columna del Kanban: encabezado con totales (estimado, meta, ponderado)
 * y lista de tarjetas de la etapa.
 */
import { useDroppable } from "@dnd-kit/core";
import { formatCurrencyCompact } from "@/lib/formatters";
import { totalesEtapa, type AvanceCriterios } from "@/features/crm/domain/criterios";
import OportunidadCard from "./OportunidadCard";
import type { ProximaActividad } from "@/features/crm/hooks";
import type { CrmOportunidadRow, CrmEtapaRow } from "@/features/crm/hooks";

const fmtMxn = (n: number) => formatCurrencyCompact(n, "MXN");

interface Props {
  etapa: CrmEtapaRow;
  ops: CrmOportunidadRow[];
  onClickCard: (id: string) => void;
  proximasMap: Map<string, ProximaActividad>;
  avanceMap: Map<string, AvanceCriterios>;
}

export default function ColumnaEtapa({ etapa, ops, onClickCard, proximasMap, avanceMap }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const totales = totalesEtapa(ops);
  const esCerrada = etapa.tipo === "ganada" || etapa.tipo === "perdida";

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/40 rounded-lg">
      <div
        className="p-3 border-b border-border rounded-t-lg border-t-[3px]"
        style={{ borderTopColor: etapa.color ?? undefined }}
      >
        <div className="font-semibold text-sm">{etapa.nombre}</div>
        <div className="text-xs text-muted-foreground">
          {totales.cantidad} · {fmtMxn(totales.estimado)}
        </div>
        <div className="text-2xs text-muted-foreground">
          Meta {fmtMxn(totales.meta)} · Ponderado {fmtMxn(totales.ponderado)}
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-48 transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {ops.map((op) => (
          <OportunidadCard
            key={op.id}
            op={op}
            onClick={() => onClickCard(op.id)}
            proxima={proximasMap.get(op.id)}
            avance={avanceMap.get(op.id)}
            esCerrada={esCerrada}
          />
        ))}
        {ops.length === 0 && (
          <div className="text-center text-xs text-muted-foreground py-8">Sin oportunidades</div>
        )}
      </div>
    </div>
  );
}
