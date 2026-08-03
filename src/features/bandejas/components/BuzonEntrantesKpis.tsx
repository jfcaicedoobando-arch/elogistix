/**
 * KPIs accionables del buzón CxP. Extraído en v13.366.0 (Power of 10 #1).
 * v13.398.0 — El KPI usado como filtro se marca como activo (anillo) para que
 * se vea por qué la lista está recortada.
 */
import { Clock, FileCode2, Inbox } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { DIAS_ATRASO_BUZON, type ChipBuzon } from "@/lib/domain/facturasEntrantesBuzon";

interface Props {
  total: number;
  atrasados: number;
  sinXml: number;
  /** Chip de filtro activo, para marcar el KPI correspondiente. */
  chipActivo?: ChipBuzon;
  onChip: (chip: ChipBuzon) => void;
}

const ANILLO_ACTIVO = "ring-2 ring-primary ring-offset-2 ring-offset-background";

export function BuzonEntrantesKpis({ total, atrasados, sinXml, chipActivo = "todos", onChip }: Props) {
  const activo = (chip: ChipBuzon) => (chipActivo === chip ? ANILLO_ACTIVO : undefined);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        label="Documentos por capturar"
        value={String(total)}
        icon={Inbox}
        className={activo("todos")}
        onClick={() => onChip("todos")}
      />
      <KpiCard
        label={`Con ${DIAS_ATRASO_BUZON} días o más`}
        value={String(atrasados)}
        icon={Clock}
        variant={atrasados > 0 ? "warning" : "default"}
        className={activo("atrasados")}
        onClick={() => onChip("atrasados")}
      />
      <KpiCard
        label="Sin XML del CFDI"
        value={String(sinXml)}
        icon={FileCode2}
        variant={sinXml > 0 ? "warning" : "default"}
        className={activo("sin_xml")}
        onClick={() => onChip("sin_xml")}
      />
    </div>
  );
}
