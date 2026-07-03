/**
 * Grid de KPIs para la página CxP. Extraído de Cxp.tsx para mantener el page < 200 líneas.
 */
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { FacturaCxP, KPIsCxP } from "@/features/cxp/services";

function KPICard({
  label, value, count, tone = "default",
}: {
  label: string; value: string; count?: number;
  tone?: "default" | "warn" | "danger";
}) {
  const toneCls = tone === "danger" ? "text-destructive"
    : tone === "warn" ? "text-warning" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <span>{label}</span>
          {count != null && (
            <span className="text-2xs text-muted-foreground/70">
              · {count} {count === 1 ? "factura" : "facturas"}
            </span>
          )}
        </p>
        <p className={cn("text-lg font-semibold tabular-nums", toneCls)}>{value}</p>
      </CardContent>
    </Card>
  );
}

export function CxpKpiCards({ kpis, data }: { kpis: KPIsCxP; data: FacturaCxP[] }) {
  let porPagarMxn = 0, porPagarUsd = 0, vencidasN = 0, porVencer7d = 0;
  for (const f of data) {
    if (f.saldo <= 0) continue;
    if (f.moneda === "USD") porPagarUsd++; else porPagarMxn++;
    if (f.estatus === "Vencida") vencidasN++;
    if (f.estatus === "Por vencer") porVencer7d++;
  }
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
      <KPICard label="Por pagar MXN" value={formatCurrency(kpis.por_pagar_mxn, "MXN")} count={porPagarMxn} />
      <KPICard label="Por pagar USD" value={formatCurrency(kpis.por_pagar_usd, "USD")} count={porPagarUsd} />
      <KPICard
        label="Vencido"
        value={`${formatCurrency(kpis.vencido_mxn, "MXN")} · ${formatCurrency(kpis.vencido_usd, "USD")}`}
        count={vencidasN}
        tone="danger"
      />
      <KPICard
        label="Por vencer 7 días"
        value={`${formatCurrency(kpis.por_vencer_7d_mxn, "MXN")} · ${formatCurrency(kpis.por_vencer_7d_usd, "USD")}`}
        count={porVencer7d}
        tone="warn"
      />
    </div>
  );
}
