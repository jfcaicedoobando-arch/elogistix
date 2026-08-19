/**
 * Fila hero del Dashboard Dirección: utilidad, cartera vencida y facturación vs meta.
 * v13.5xx: migrado a `KpiCard` canónico — plano por defecto, color sólo en alarma.
 */
import { AlertTriangle, ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatPercent } from "@/lib/formatters/numbers";
import { META_FACTURACION_MENSUAL_MXN } from "@/features/dashboard/direccion/constants";
import type { HeroKpis } from "@/features/dashboard/direccion/services/tipos";

function fmt(n: number): string { return formatCurrency(n, "MXN"); }

function DeltaMargen({ actual, previo }: { actual: number; previo: number }) {
  const delta = actual - previo;
  const Icon = delta > 0.05 ? ArrowUp : delta < -0.05 ? ArrowDown : ArrowRight;
  const color = delta > 0.05 ? "text-success" : delta < -0.05 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-body-sm ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pts vs mes anterior
    </span>
  );
}

export function HeroCards({ hero }: { hero: HeroKpis }) {
  const meta = META_FACTURACION_MENSUAL_MXN;
  const avance = meta > 0 ? Math.min(100, (hero.facturado_mes_mxn / meta) * 100) : 0;
  const hayCarteraVencida = hero.cartera_vencida_mxn > 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <KpiCard
        label="Utilidad bruta del mes"
        value={fmt(hero.utilidad_mxn)}
        sublabel={`Margen ${formatPercent(hero.margen_pct)}`}
      >
        <DeltaMargen actual={hero.margen_pct} previo={hero.margen_pct_prev} />
      </KpiCard>

      <KpiCard
        label="Cartera vencida"
        value={fmt(hero.cartera_vencida_mxn)}
        icon={AlertTriangle}
        variant={hayCarteraVencida ? "destructive" : "default"}
        sublabel={`${hero.cartera_vencida_clientes} cliente${hero.cartera_vencida_clientes === 1 ? "" : "s"} con saldo vencido`}
      />

      <KpiCard
        label="Facturación del mes"
        value={fmt(hero.facturado_mes_mxn)}
        sublabel={`${formatPercent(avance)} de la meta (${fmt(meta)})`}
      >
        <Progress value={avance} className="mt-1 h-2" />
      </KpiCard>
    </div>
  );
}
