/**
 * Barra flotante de totales del wizard de cotización (P1 — v13.294.0).
 *
 * Se muestra en pasos 2 y 3 y consume los totales que ya calcula
 * `useCotizacionWizardForm` (P&L en USD/MXN + venta total en MXN).
 *
 * NO hace matemática nueva: sólo formatea + colorea el margen.
 *  - Verde  ≥15%
 *  - Ámbar  5-15%
 *  - Rojo   <5%
 */
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { TotalesPL } from "@/lib/financial/profitUtils";

interface Props {
  plUSD: TotalesPL;
  plMXN: TotalesPL;
  totalVentaMXN: number;
}

function nivel(porcentaje: number): { color: string; icon: typeof TrendingUp } {
  if (porcentaje >= 15) return { color: "[color:hsl(var(--success))]", icon: TrendingUp };
  if (porcentaje >= 5) return { color: "text-warning", icon: Minus };
  return { color: "text-destructive", icon: TrendingDown };
}

export function WizardTotalsBar({ plUSD, plMXN, totalVentaMXN }: Props) {
  // Margen consolidado: prioriza USD si hay venta en USD; si no, MXN.
  const consolidado = plUSD.totalVenta > 0 ? plUSD : plMXN;
  const monedaConsolidada = plUSD.totalVenta > 0 ? "USD" : "MXN";
  const { color, icon: Icon } = nivel(consolidado.porcentaje);

  return (
    <div
      role="status"
      aria-label="Totales de la cotización"
      className="sticky bottom-0 left-0 right-0 z-10 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-sticky-top"
    >
      <div className="max-w-6xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Metric label="Costo" mxn={plMXN.totalCosto} usd={plUSD.totalCosto} />
          <Metric label="Venta" mxn={totalVentaMXN} usd={plUSD.totalVenta} />
        </div>
        <div className={`flex items-center gap-2 font-semibold ${color}`}>
          <Icon className="h-4 w-4" aria-hidden />
          <span>
            Margen {monedaConsolidada}:{" "}
            {formatCurrency(consolidado.profit, monedaConsolidada)}
          </span>
          <span className="rounded-md px-2 py-0.5 bg-current/10 text-xs">
            {consolidado.porcentaje.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, mxn, usd }: { label: string; mxn: number; usd: number }) {
  return (
    <div className="flex flex-col leading-tight">
      <span className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <span className="font-medium tabular-nums">{formatCurrency(mxn, "MXN")}</span>
        {usd > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            ({formatCurrency(usd, "USD")})
          </span>
        )}
      </div>
    </div>
  );
}
