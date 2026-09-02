/**
 * Tarjetas KPI de la bandeja /compras/por-pagar.
 * Extraído de `CxpPorPagar.tsx` (v13.317.9) — sólo presentación.
 *
 * v13.424.0 — Migradas de Card/CardHeader artesanales a la `KpiCard` canónica
 * para que se vean idénticas a las bandejas de facturación y tesorería.
 */
import { FileText, Wallet, AlertTriangle } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import type { CxpPagarSummary } from "@/features/bandejas/domain/aggregates";

interface Props {
  totalFacturas: number;
  resumen: Pick<CxpPagarSummary, "saldoMXN" | "porMoneda" | "faltaTipoCambio" | "vencidas">;
}

export function CxpPorPagarKpis({ totalFacturas, resumen }: Props) {
  const { saldoMXN, porMoneda, faltaTipoCambio, vencidas } = resumen;
  return (
    // v13.823.25 (fold 692px): 2 columnas en móvil; "Saldo total" abarca el
    // renglón completo porque lleva desglose por moneda y avisos de TC.
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
      <KpiCard label="Facturas vigentes" value={totalFacturas} icon={FileText} />
      <KpiCard
        label="Saldo total"
        value={formatCurrency(saldoMXN, "MXN")}
        icon={Wallet}
        valueTooltip={formatCurrency(saldoMXN, "MXN")}
        className="col-span-2 md:col-span-1"
      >

        <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-label text-muted-foreground">
          {porMoneda.MXN > 0 && <span>{formatCurrencyCompact(porMoneda.MXN, "MXN")}</span>}
          {porMoneda.USD > 0 && <span>· {formatCurrencyCompact(porMoneda.USD, "USD")}</span>}
          {porMoneda.EUR > 0 && <span>· {formatCurrencyCompact(porMoneda.EUR, "EUR")}</span>}
        </div>
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
