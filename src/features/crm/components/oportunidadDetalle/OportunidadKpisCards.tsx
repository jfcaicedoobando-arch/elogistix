/**
 * KPIs del detalle de oportunidad (CRM).
 *
 * v13.424.0 — Migradas de Card/CardHeader artesanales a la `KpiCard` canónica.
 */
import { Layers, Target, TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrencyCompact } from "@/lib/formatters";

interface Etapa {
  id: string;
  nombre: string;
  color?: string | null;
}

interface Props {
  etapa: Etapa | undefined;
  montoEstimado: number;
  valorReal: number | null;
  probabilidad: number;
  moneda: string;
}

function ValorCard({ valorReal, montoEstimado, probabilidad, moneda }: Omit<Props, "etapa">) {
  const esCerrado = valorReal != null;
  const valor = esCerrado ? valorReal : montoEstimado * (probabilidad / 100);
  return (
    <KpiCard
      label={esCerrado ? "Valor real" : "Ponderado"}
      value={formatCurrencyCompact(Number(valor ?? 0), moneda)}
      sublabel={esCerrado ? "Cerrado" : `${probabilidad}% de probabilidad`}
      icon={TrendingUp}
      variant={esCerrado ? "success" : "default"}
    />
  );
}

export function OportunidadKpisCards({ etapa, montoEstimado, valorReal, probabilidad, moneda }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiCard label="Etapa" value={etapa?.nombre ?? "—"} icon={Layers}>
        {etapa?.color ? (
          <span
            aria-hidden
            className="mt-1 inline-block h-1.5 w-10 rounded-full"
            // Color configurable por el usuario en el catálogo de etapas.
            style={{ backgroundColor: etapa.color }}
          />
        ) : null}
      </KpiCard>
      <KpiCard
        label="Monto estimado"
        value={formatCurrencyCompact(montoEstimado, moneda)}
        icon={Target}
      />
      <ValorCard valorReal={valorReal} montoEstimado={montoEstimado} probabilidad={probabilidad} moneda={moneda} />
    </div>
  );
}
