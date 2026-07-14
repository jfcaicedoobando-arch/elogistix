/**
 * Fila hero del Dashboard Dirección: utilidad, cartera vencida y facturación vs meta.
 */
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowDown, ArrowRight, ArrowUp, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/numbers";
import { META_FACTURACION_MENSUAL_MXN } from "@/features/dashboard/direccion/constants";
import type { HeroKpis } from "@/features/dashboard/direccion/services/tipos";

function fmt(n: number): string { return formatCurrency(n, "MXN"); }
function pct(n: number): string { return `${n.toFixed(1)}%`; }

function DeltaMargen({ actual, previo }: { actual: number; previo: number }) {
  const delta = actual - previo;
  const Icon = delta > 0.05 ? ArrowUp : delta < -0.05 ? ArrowDown : ArrowRight;
  const color = delta > 0.05 ? "text-success" : delta < -0.05 ? "text-destructive" : "text-muted-foreground";
  return (
    <span className={`inline-flex items-center gap-1 text-sm ${color}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {delta >= 0 ? "+" : ""}{delta.toFixed(1)} pts vs mes anterior
    </span>
  );
}

export function HeroCards({ hero }: { hero: HeroKpis }) {
  const meta = META_FACTURACION_MENSUAL_MXN;
  const avance = meta > 0 ? Math.min(100, (hero.facturado_mes_mxn / meta) * 100) : 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="p-5 rounded-xl border border-border bg-card">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Utilidad bruta del mes</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.utilidad_mxn)}</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">Margen {pct(hero.margen_pct)}</p>
        <div className="mt-2"><DeltaMargen actual={hero.margen_pct} previo={hero.margen_pct_prev} /></div>
      </Card>

      <Card className="p-5 rounded-xl border border-destructive/40 bg-destructive/5">
        <p className="text-xs uppercase tracking-wide text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Cartera vencida
        </p>
        <p className="mt-2 text-3xl font-semibold tabular-nums text-destructive">{fmt(hero.cartera_vencida_mxn)}</p>
        <p className="mt-1 text-sm text-destructive/80 tabular-nums">
          {hero.cartera_vencida_clientes} cliente{hero.cartera_vencida_clientes === 1 ? "" : "s"} con saldo vencido
        </p>
      </Card>

      <Card className="p-5 rounded-xl border border-border bg-card">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Facturación del mes</p>
        <p className="mt-2 text-3xl font-semibold tabular-nums">{fmt(hero.facturado_mes_mxn)}</p>
        <p className="mt-1 text-sm text-muted-foreground tabular-nums">
          {avance.toFixed(1)}% de la meta ({fmt(meta)})
        </p>
        <Progress value={avance} className="mt-3 h-2" />
      </Card>
    </div>
  );
}
