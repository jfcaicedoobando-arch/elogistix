import { AlertTriangle, AlertCircle, Info } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatNumber } from "@/lib/formatters";

interface Props {
  critico: number;
  alto: number;
  medio: number;
}

/**
 * KPIs de auditoría — migrados al `KpiCard` canónico para unificar el
 * design language (font-semibold, sin uppercase, padding p-4).
 */
export function AuditoriaKpis({ critico, alto, medio }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <KpiCard
        label="Críticos"
        value={formatNumber(critico)}
        icon={AlertCircle}
        variant="destructive"
        sublabel="Requieren atención inmediata"
      />
      <KpiCard
        label="Altos"
        value={formatNumber(alto)}
        icon={AlertTriangle}
        variant="warning"
        sublabel="Documentos faltantes en operación"
      />
      <KpiCard
        label="Medios"
        value={formatNumber(medio)}
        icon={Info}
        variant="info"
        sublabel="Inconsistencias menores"
      />
    </div>
  );
}
