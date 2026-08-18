/**
 * KPIs de salud del proveedor (RPC `proveedor_salud`): gasto 12m, saldo,
 * puntualidad de pago, notas de crédito y embarques activos.
 */
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/shared/KpiCard";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { SaludProveedor } from "@/features/cxp/services";

function semaforoToneFromPct(pct: number | null): "good" | "warn" | "bad" {
  if (pct == null) return "warn";
  if (pct >= 90) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

export function ProveedorSaludKpis({ data }: { data: SaludProveedor }) {
  const tonePct = semaforoToneFromPct(data.pct_pagadas_a_tiempo);
  const semaforoLabel =
    tonePct === "good" ? "Excelente puntualidad" :
    tonePct === "warn" ? "Puntualidad media" : "Atención: pagos tardíos";

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <SectionHeading>Salud del proveedor</SectionHeading>
        <Badge
          className={cn(
            tonePct === "good" && "bg-success/15 text-success border-success/30",
            tonePct === "warn" && "bg-warning/15 text-warning border-warning/30",
            tonePct === "bad" && "bg-destructive/15 text-destructive border-destructive/30",
          )}
        >
          {semaforoLabel}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <KpiCard
          label="Facturas últimos 12m"
          value={formatCurrencyCompact(data.monto_12m, "MXN")}
          valueTooltip={formatCurrency(data.monto_12m, "MXN")}
          sublabel={`${data.facturas_12m} factura${data.facturas_12m === 1 ? "" : "s"} · convertido a MXN (TC DOF)`}
        />
        <KpiCard
          label="Saldo actual (MXN)"
          value={formatCurrency(data.saldo_actual, "MXN")}
          variant={data.saldo_actual > 0 ? "warning" : "success"}
        />
        <KpiCard
          label="% Pagadas a tiempo"
          value={data.pct_pagadas_a_tiempo == null ? "—" : `${data.pct_pagadas_a_tiempo.toFixed(0)}%`}
          variant={tonePct === "good" ? "success" : tonePct === "warn" ? "warning" : "destructive"}
        />
        <KpiCard
          label="Días promedio de pago"
          value={data.dias_promedio_pago == null ? "—" : `${data.dias_promedio_pago.toFixed(0)} d`}
        />
        <KpiCard
          label="Notas de crédito"
          value={String(data.notas_credito_count)}
          sublabel={formatCurrency(data.notas_credito_monto, "MXN")}
        />
        <KpiCard label="Embarques activos" value={String(data.embarques_activos)} />
      </div>
    </div>
  );
}
