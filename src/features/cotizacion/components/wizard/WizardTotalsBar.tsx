/**
 * Barra flotante de totales del wizard de cotización (P1 — v13.294.0).
 *
 * Paso 2 presenta el presupuesto del costeo. Paso 3 lo combina con
 * conceptos cliente vigentes usando el mismo helper neto que el resumen.
 * Las dos monedas se presentan separadas, sin IVA ni conversión.
 *  - Verde  ≥15%
 *  - Ámbar  5-15%
 *  - Rojo   <5%
 */
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/types";
import { resumirUtilidadCotizacion } from "@/features/cotizacion/domain/resumenUtilidadCotizacion";
import { formatPercent } from "@/lib/formatters";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatCurrency } from "@/lib/formatters/numbers";
import type { TotalesPL } from "@/lib/financial/profitUtils";

interface Props {
  conceptosVenta?: ConceptoVentaCotizacion[];
  sinCostosRegistrados?: boolean;
  plUSD: TotalesPL;
  plMXN: TotalesPL;
}

function nivel(porcentaje: number): { color: string; icon: typeof TrendingUp } {
  if (porcentaje >= 15) return { color: "[color:hsl(var(--success))]", icon: TrendingUp };
  if (porcentaje >= 5) return { color: "text-warning", icon: Minus };
  return { color: "text-destructive", icon: TrendingDown };
}

export function WizardTotalsBar({ plUSD: costoUSD, plMXN: costoMXN, conceptosVenta, sinCostosRegistrados }: Props) {
  const resumen = resumirUtilidadCotizacion(costoUSD, costoMXN, conceptosVenta, { sinCostosRegistrados });
  if (!resumen.ok) return <p role="status" className="text-body-sm text-muted-foreground">{resumen.mensaje}</p>;
  const { totalesUSD: plUSD, totalesMXN: plMXN } = resumen;
  // W-06 (QA r2): antes se mostraba un solo margen "consolidado" que
  // priorizaba USD e ignoraba por completo la utilidad en pesos. Ahora se
  // muestra un margen por moneda con venta; nunca se suman monedas distintas.
  const hayUSD = plUSD.totalVenta > 0 || (conceptosVenta !== undefined && (plUSD.totalCosto > 0 || resumen.tieneVentaUSD));
  const hayMXN = plMXN.totalVenta > 0 || (conceptosVenta !== undefined && (plMXN.totalCosto > 0 || resumen.tieneVentaMXN));

  return (
    // v13.823.286 — ya no flota sobre el contenido: vive dentro del pie del
    // wizard, en la misma franja que Anterior/Siguiente.
    <div
      role="status"
      aria-label="Totales de la cotización"
      className="border-b pb-2 mb-2"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-body">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <Metric label="Costo" mxn={plMXN.totalCosto} usd={plUSD.totalCosto} />
          {/* Paso 2: presupuesto del costeo. Paso 3: venta cliente neta vigente. */}
          <Metric label="Venta (sin IVA)" mxn={plMXN.totalVenta} usd={plUSD.totalVenta} mostrarUSD={hayUSD} mostrarMXN={hayMXN} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          {hayUSD && <Margen moneda="USD" pl={plUSD} />}
          {hayMXN && <Margen moneda="MXN" pl={plMXN} />}
          {!hayUSD && !hayMXN && (
            <span className="text-body-sm text-muted-foreground">Margen: n/a (sin venta capturada)</span>
          )}
        </div>
      </div>
      {conceptosVenta && resumen.usaCosteo && <p className="text-body-sm text-muted-foreground">Sin conceptos de venta: se muestra la estimación del costeo.</p>}
    </div>
  );
}

function Margen({ moneda, pl }: { moneda: "USD" | "MXN"; pl: TotalesPL }) {
  if (pl.totalVenta <= 0) return (
    <div className="text-body-sm text-muted-foreground">
      <span>Utilidad {moneda}: {formatCurrency(pl.profit, moneda)}</span>
      <span className="ml-2">Margen: no calculable (sin venta capturada)</span>
    </div>
  );
  const { color, icon: Icon } = nivel(pl.porcentaje);
  return (
    <div className={`flex items-center gap-2 font-semibold ${color}`}>
      <Icon className="h-4 w-4" aria-hidden />
      <span>
        Margen {moneda}: {formatCurrency(pl.profit, moneda)}
      </span>
      <span className="rounded-md px-2 py-0.5 bg-current/10 text-body-sm">
        {formatPercent(pl.porcentaje)}
      </span>
    </div>
  );
}

function Metric({ label, mxn, usd, mostrarUSD, mostrarMXN }: { label: string; mxn: number; usd: number; mostrarUSD?: boolean; mostrarMXN?: boolean }) {
  const hayMXN = mostrarMXN || mxn > 0;
  const hayUSD = mostrarUSD || usd > 0;

  return (
    <div className="flex flex-col leading-tight">
      <span className="text-overline">{label}</span>
      <div className="flex items-center gap-2">
        {hayMXN && <span className="font-medium tabular-nums">{formatCurrency(mxn, "MXN")}</span>}
        {hayUSD && (
          <span className="text-body-sm text-muted-foreground tabular-nums">
            {hayMXN ? `(${formatCurrency(usd, "USD")})` : formatCurrency(usd, "USD")}
          </span>
        )}
        {!hayMXN && !hayUSD && (
          <span className="font-medium tabular-nums">{formatCurrency(0, "MXN")}</span>
        )}
      </div>
    </div>
  );
}
