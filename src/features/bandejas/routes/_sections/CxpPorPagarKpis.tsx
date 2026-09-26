/**
 * Tarjetas KPI de la bandeja /compras/por-pagar.
 * Extraído de `CxpPorPagar.tsx` (v13.317.9) — sólo presentación.
 *
 * v13.424.0 — Migradas de Card/CardHeader artesanales a la `KpiCard` canónica
 * para que se vean idénticas a las bandejas de facturación y tesorería.
 */
import { FileText, Wallet, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency } from "@/lib/formatters";
import type { CxpPagarSummary } from "@/features/bandejas/domain/aggregates";

interface Props {
  totalFacturas: number;
  resumen: Pick<CxpPagarSummary, "saldoMXN" | "porMoneda" | "faltaTipoCambio" | "vencidas">;
}

export function CxpPorPagarKpis({ totalFacturas, resumen }: Props) {
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumen;
  const hayMonedaExtranjera = porMoneda.USD > 0 || porMoneda.EUR > 0;
  return (
    // v13.823.25 (fold 692px): 2 columnas en móvil; "Saldo total" abarca el
    // renglón completo porque lleva desglose por moneda y avisos de TC.
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      <KpiCard label="Facturas vigentes" value={totalFacturas} icon={FileText} />
      <KpiCard
        label={hayMonedaExtranjera ? "Saldo total en MXN" : "Saldo total"}
        value={formatCurrency(saldoMXN, "MXN")}
        icon={Wallet}
        valueTooltip={formatCurrency(saldoMXN, "MXN")}
        className="col-span-2 md:col-span-1"
      >
        {hayMonedaExtranjera && (
          <div className="mt-1 space-y-0.5 text-label text-muted-foreground">
            <p>Desglose en moneda original:</p>
            {porMoneda.MXN > 0 && <p>{formatCurrency(porMoneda.MXN, "MXN")}</p>}
            {porMoneda.USD > 0 && <p>{formatCurrency(porMoneda.USD, "USD")}</p>}
            {porMoneda.EUR > 0 && <p>{formatCurrency(porMoneda.EUR, "EUR")}</p>}
          </div>
        )}
        {faltaTipoCambio > 0 && (
          <p className="mt-0.5 text-2xs text-warning">
            {faltaTipoCambio} factura{faltaTipoCambio > 1 ? "s" : ""} sin TC capturado — no incluida
            {faltaTipoCambio > 1 ? "s" : ""} en homologado.
          </p>
        )}
      </KpiCard>
      <KpiCard
        label="Vencidas"
        value={vencidas}
        icon={AlertTriangle}
        variant={vencidas > 0 ? "destructive" : "default"}
      />
    </div>
  );
}
