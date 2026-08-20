/**
 * Franja de resumen del pipeline: total estimado, meta y ponderado por probabilidad.
 */
import { TrendingUp, Target, Scale } from "lucide-react";
import { formatCurrency, porcentajeEntero } from "@/lib/formatters";
import { totalesEtapa } from "@/features/crm/domain/criterios";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  oportunidades: CrmOportunidadRow[];
}

export default function PipelineResumen({ oportunidades }: Props) {
  const t = totalesEtapa(oportunidades);
  const cumplimiento = porcentajeEntero(t.estimado, t.meta);

  const items = [
    { icon: TrendingUp, label: "Estimado", valor: formatCurrency(t.estimado, "MXN") },
    { icon: Target, label: "Meta", valor: formatCurrency(t.meta, "MXN") },
    { icon: Scale, label: "Ponderado", valor: formatCurrency(t.ponderado, "MXN") },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      {items.map(({ icon: Icon, label, valor }) => (
        <div key={label} className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <div>
            <div className="text-label uppercase text-muted-foreground">{label}</div>
            <div className="text-body font-semibold tabular-nums">{valor}</div>
          </div>
        </div>
      ))}
      <div className="ml-auto text-body-sm text-muted-foreground">
        {t.cantidad} oportunidades abiertas
        {cumplimiento != null ? ` · ${cumplimiento}% de la meta capturada` : ""}
      </div>
    </div>
  );
}
