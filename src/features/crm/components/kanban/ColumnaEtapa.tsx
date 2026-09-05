/**
 * Columna del Kanban: encabezado con totales (estimado, meta, ponderado)
 * y lista de tarjetas de la etapa.
 * Ola 8: la lista se pagina por etapa (LIMITE_ETAPA_INICIAL + "Mostrar más")
 * para que una etapa con cientos de oportunidades no congele el tablero; el
 * aviso de truncamiento reemplaza al render silencioso de todo el historial.
 */
import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Briefcase } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { Button } from "@/components/ui/button";
import { formatCurrencyCompact } from "@/lib/formatters";
import { totalesEtapa, type AvanceCriterios, type TotalesEtapaMoneda } from "@/features/crm/domain/criterios";
import { colorAcentoEtapa } from "@/features/crm/lib/etapaColores";
import OportunidadCard from "./OportunidadCard";
import type { ProximaActividad } from "@/features/crm/hooks";
import type { CrmOportunidadRow, CrmEtapaRow } from "@/features/crm/hooks";

function textoPorMoneda(porMoneda: TotalesEtapaMoneda[], campo: "estimado" | "meta" | "ponderado"): string {
  if (porMoneda.length === 0) return formatCurrencyCompact(0, "MXN");
  return porMoneda.map((p) => formatCurrencyCompact(p[campo], p.moneda)).join(" · ");
}

/** Tarjetas renderizadas por etapa al abrir el tablero y por cada "Mostrar más". */
export const LIMITE_ETAPA_INICIAL = 50;
export const INCREMENTO_ETAPA = 50;

interface Props {
  etapa: CrmEtapaRow;
  ops: CrmOportunidadRow[];
  onClickCard: (id: string) => void;
  proximasMap: Map<string, ProximaActividad>;
  avanceMap: Map<string, AvanceCriterios>;
  /** CTA del estado vacío (E-11). Recibe el id de ESTA etapa para prefijarla
      en el formulario; sin esto la oportunidad nacía en otra columna. */
  onNuevo?: (etapaId: string) => void;
  /** Permiso real de mover cada oportunidad entre etapas. */
  puedeArrastrar?: (op: CrmOportunidadRow) => boolean;
}

export default function ColumnaEtapa({ etapa, ops, onClickCard, proximasMap, avanceMap, onNuevo, puedeArrastrar }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: etapa.id });
  const [visibles, setVisibles] = useState(LIMITE_ETAPA_INICIAL);
  const totales = totalesEtapa(ops);
  const esCerrada = etapa.tipo === "ganada" || etapa.tipo === "perdida";
  const opsVisibles = ops.slice(0, visibles);
  const ocultas = ops.length - opsVisibles.length;

  return (
    <div className="flex-shrink-0 w-72 flex flex-col bg-muted/40 rounded-lg snap-start">
      <div
        className="p-3 border-b border-border rounded-t-lg border-t-[3px]"
        style={{ borderTopColor: colorAcentoEtapa(etapa) }}
      >
        <div className="font-semibold text-body">{etapa.nombre}</div>
        <div className="text-body-sm text-muted-foreground">
          {totales.cantidad} · {textoPorMoneda(totales.porMoneda, "estimado")}
        </div>
        {/* VF-22: en columna vacía "Meta MXN 0 · Ponderado MXN 0" era ruido
            repetido bajo cada etapa; sólo se muestra cuando hay algo que medir. */}
        {totales.cantidad > 0 && (
          <div className="text-label text-muted-foreground">
            Meta {textoPorMoneda(totales.porMoneda, "meta")} · Ponderado {textoPorMoneda(totales.porMoneda, "ponderado")}
          </div>
        )}
      </div>
      {/* E-6: alto mínimo acotado en vez de estirarse a la altura de la
          columna más llena del tablero (antes ~900px en móvil vacío). */}
      <div
        ref={setNodeRef}
        className={`flex-1 p-2 space-y-2 min-h-40 transition-colors ${isOver ? "bg-primary/5" : ""}`}
      >
        {opsVisibles.map((op) => (
          <OportunidadCard
            key={op.id}
            op={op}
            onClick={() => onClickCard(op.id)}
            proxima={proximasMap.get(op.id)}
            avance={avanceMap.get(op.id)}
            esCerrada={esCerrada}
            arrastrable={puedeArrastrar ? puedeArrastrar(op) : true}
          />
        ))}
        {ops.length === 0 && (
          // E-11: mismo componente de estado vacío que el resto del ERP, con
          // CTA coherente en vez del icono de maletín propio del Kanban.
          <EmptyStateInline
            icon={Briefcase}
            message="Sin oportunidades"
            density="compact"
            action={!esCerrada && onNuevo ? { label: "Nueva oportunidad", onClick: () => onNuevo(etapa.id) } : undefined}
          />
        )}
        {ocultas > 0 && (
          <div className="flex flex-col items-center gap-1.5 border-t border-border px-2 pt-2 pb-1">
            <span className="text-label text-warning">
              Mostrando {opsVisibles.length} de {ops.length} en esta etapa
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setVisibles((v) => v + INCREMENTO_ETAPA)}
            >
              Mostrar más
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
