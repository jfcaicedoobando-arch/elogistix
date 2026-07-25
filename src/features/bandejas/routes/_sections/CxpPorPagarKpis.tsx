/**
 * Tarjetas KPI de la bandeja /compras/por-pagar.
 * Extraído de `CxpPorPagar.tsx` (v13.317.9) — sólo presentación.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { resumirCxpPorPagar } from "@/features/bandejas/domain/aggregates";

type Resumen = ReturnType<typeof resumirCxpPorPagar>;

interface Props {
  totalFacturas: number;
  resumen: Resumen;
}

export function CxpPorPagarKpis({ totalFacturas, resumen }: Props) {
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumen;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Facturas vigentes</CardTitle></CardHeader>
        <CardContent className="text-2xl font-semibold">{totalFacturas}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo total</CardTitle></CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">{formatCurrency(saldoMXN, "MXN")}</div>
          <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-label text-muted-foreground mt-1">
            {porMoneda.MXN > 0 && <span>{formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
            {porMoneda.USD > 0 && <span>· {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
            {porMoneda.EUR > 0 && <span>· {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
          </div>
          {faltaTipoCambio > 0 && (
            <p className="text-2xs text-warning mt-0.5">
              {faltaTipoCambio} factura{faltaTipoCambio > 1 ? "s" : ""} sin TC capturado — no incluida{faltaTipoCambio > 1 ? "s" : ""} en homologado.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Vencidas</CardTitle></CardHeader>
        <CardContent className="text-2xl font-semibold text-destructive">{vencidas}</CardContent>
      </Card>
    </div>
  );
}
