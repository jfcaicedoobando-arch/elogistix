/**
 * KPIs accionables del buzón CxP. Extraído en v13.366.0 (Power of 10 #1).
 */
import { Clock, FileCode2, Inbox } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { DIAS_ATRASO_BUZON, type ChipBuzon } from "@/lib/domain/facturasEntrantesBuzon";

interface Props {
  total: number;
  atrasados: number;
  sinXml: number;
  onChip: (chip: ChipBuzon) => void;
}

export function BuzonEntrantesKpis({ total, atrasados, sinXml, onChip }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Documentos por capturar"
        value={String(total)}
        icon={Inbox}
        onClick={() => onChip("todos")}
      />
      <KpiCard
        label={`Con ${DIAS_ATRASO_BUZON} días o más`}
        value={String(atrasados)}
        icon={Clock}
        variant={atrasados > 0 ? "warning" : "default"}
        onClick={() => onChip("atrasados")}
      />
      <KpiCard
        label="Sin XML del CFDI"
        value={String(sinXml)}
        icon={FileCode2}
        variant={sinXml > 0 ? "warning" : "default"}
        onClick={() => onChip("sin_xml")}
      />
    </div>
  );
}
