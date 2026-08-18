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
  return (
    <div
      className="text-xs text-muted-foreground mt-1"
      title={
        estimado
          ? "Convertido con tipo de cambio de respaldo (no oficial): úsalo sólo como referencia."
          : eq.facturasSinTc > 0
            ? `${eq.facturasSinTc} moneda(s) sin tipo de cambio`
            : undefined
      }
    >
      ≈ {formatCurrency(eq.totalMxn, "MXN")} equivalente
      {estimado && <span className="ml-1 text-warning">(T/C estimado)</span>}
      {eq.facturasSinTc > 0 && <span className="ml-1">({eq.facturasSinTc} sin TC)</span>}
    </div>
  );
}

export function CarteraKpis(p: Props) {
  return (
    <div className="space-y-3">
    <TipoCambioFallbackBanner />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle>Facturas en foco</CardTitle></CardHeader>
        <CardContent className="text-kpi">{p.totalFacturas}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Saldo total</CardTitle></CardHeader>
        <CardContent>
          <div className="text-kpi tabular-nums">{formatNativos(p.saldosNativos)}</div>
          <Equivalencia saldos={p.saldosNativos} eq={p.eqTotal} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle>Vencido ({p.vencidasCount})</CardTitle></CardHeader>
        <CardContent>
          <div className="text-kpi text-destructive tabular-nums">
            {formatNativos(p.vencidoNativo)}
          </div>
          <Equivalencia saldos={p.vencidoNativo} eq={p.eqVencido} />
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
