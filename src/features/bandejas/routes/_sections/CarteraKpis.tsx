/**
 * Tarjetas KPI de Cartera (facturas en foco, saldo total, vencido).
 * Extraídas de `Cartera.tsx` para respetar el límite de 200 líneas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { type SaldosPorMonedaCartera } from "@/features/bandejas/domain/aggregates";
import { requiereEquivalente } from "@/features/bandejas/domain/carteraFx";
import { formatNativos } from "@/features/bandejas/domain/carteraFormat";
import { useExchangeRates } from "@/features/catalogos/hooks";
import { TipoCambioFallbackBanner } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";
import { Hint } from "@/components/shared/Hint";

interface Equivalente {
  totalMxn: number;
  facturasSinTc: number;
}

interface Props {
  totalFacturas: number;
  saldosNativos: SaldosPorMonedaCartera;
  vencidasCount: number;
  vencidoNativo: SaldosPorMonedaCartera;
  eqTotal: Equivalente;
  eqVencido: Equivalente;
}


function Equivalencia({ saldos, eq }: { saldos: SaldosPorMonedaCartera; eq: Equivalente }) {
  // EC-10: el equivalente en MXN puede venir del respaldo operativo (no fiscal).
  const { data: rates } = useExchangeRates();
  const estimado = rates?.esFallback === true;
  if (!requiereEquivalente(saldos)) return null;
  const hint = estimado
    ? "Convertido con tipo de cambio de respaldo (no oficial): úsalo sólo como referencia."
    : eq.facturasSinTc > 0
      ? `${eq.facturasSinTc} moneda(s) sin tipo de cambio`
      : undefined;
  return (
    <Hint label={hint}>
      <div className="text-xs text-muted-foreground mt-1">
        ≈ {formatCurrency(eq.totalMxn, "MXN")} equivalente
        {estimado && <span className="ml-1 text-warning">(T/C estimado)</span>}
        {eq.facturasSinTc > 0 && <span className="ml-1">({eq.facturasSinTc} sin TC)</span>}
      </div>
    </Hint>
  );
}

export function CarteraKpis(p: Props) {
  return (
    <div className="space-y-3">
    <TipoCambioFallbackBanner />
    {/* v13.823.25: grid-cols-2 en móvil (antes 1 columna, tarjetas muy anchas
        y con mucho espacio vacío en plegables ~692px). Header/content
        compactos sólo <md; desktop (md:grid-cols-3) queda intacto. */}
    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
      <Card>
        <CardHeader className="p-3 pb-1 md:p-6 md:pb-2"><CardTitle className="text-label md:text-card-title">Facturas en foco</CardTitle></CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0 text-body-sm md:text-kpi">{p.totalFacturas}</CardContent>
      </Card>
      <Card>
        <CardHeader className="p-3 pb-1 md:p-6 md:pb-2"><CardTitle className="text-label md:text-card-title">Saldo total</CardTitle></CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <div className="text-body-sm md:text-kpi tabular-nums">{formatNativos(p.saldosNativos)}</div>
          <Equivalencia saldos={p.saldosNativos} eq={p.eqTotal} />
        </CardContent>
      </Card>
      <Card className="col-span-2 md:col-span-1">
        <CardHeader className="p-3 pb-1 md:p-6 md:pb-2"><CardTitle className="text-label md:text-card-title">Vencido ({p.vencidasCount})</CardTitle></CardHeader>
        <CardContent className="p-3 pt-0 md:p-6 md:pt-0">
          <div className="text-body-sm md:text-kpi text-destructive tabular-nums">
            {formatNativos(p.vencidoNativo)}
          </div>
          <Equivalencia saldos={p.vencidoNativo} eq={p.eqVencido} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
