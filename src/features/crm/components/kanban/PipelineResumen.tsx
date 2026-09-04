/**
 * Franja de resumen del pipeline: total estimado, meta y ponderado por probabilidad.
 * P1-CRM: las oportunidades pueden estar en MXN/USD/EUR; nunca se suman
 * monedas distintas ni se etiqueta el total como MXN — se muestran subtotales
 * separados por moneda (p. ej. "$1,000.00 MXN · $500.00 USD").
 */
import { copiaOportunidadesAbiertas } from "@/features/crm/routes/oportunidadesContadorCopy";
import { TrendingUp, Target, Scale } from "lucide-react";
import { formatCurrency, porcentajeEntero } from "@/lib/formatters";
import { totalesEtapa, type TotalesEtapaMoneda } from "@/features/crm/domain/criterios";
import type { CrmOportunidadRow } from "@/features/crm/hooks";

interface Props {
  oportunidades: CrmOportunidadRow[];
}

function textoPorMoneda(porMoneda: TotalesEtapaMoneda[], campo: "estimado" | "meta" | "ponderado"): string {
  if (porMoneda.length === 0) return formatCurrency(0, "MXN");
  return porMoneda.map((p) => formatCurrency(p[campo], p.moneda)).join(" · ");
}

export default function PipelineResumen({ oportunidades }: Props) {
  const t = totalesEtapa(oportunidades);
  // El % de meta capturada sólo tiene sentido comparando dentro de la misma
  // moneda; con monedas mezcladas no hay una cifra única que no sea inventada.
  const unicaMoneda = t.porMoneda.length === 1 ? t.porMoneda[0] : null;
  const cumplimiento = unicaMoneda ? porcentajeEntero(unicaMoneda.estimado, unicaMoneda.meta) : null;

  const items = [
    { icon: TrendingUp, label: "Estimado", valor: textoPorMoneda(t.porMoneda, "estimado") },
    { icon: Target, label: "Meta", valor: textoPorMoneda(t.porMoneda, "meta") },
    { icon: Scale, label: "Ponderado", valor: textoPorMoneda(t.porMoneda, "ponderado") },
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
        {copiaOportunidadesAbiertas(t.cantidad)}
        {cumplimiento != null ? ` · ${cumplimiento}% de la meta capturada` : ""}
      </div>
    </div>
  );
}
