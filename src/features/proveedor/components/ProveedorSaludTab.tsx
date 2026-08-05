/**
 * Scorecard de salud del proveedor — pestaña dentro del detalle de proveedor.
 * Consume la RPC `proveedor_salud`.
 */
import { Card, CardContent } from "@/components/ui/card";
import { KpiCard } from "@/components/shared/KpiCard";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useProveedorSalud } from "@/features/cxp/hooks/useProveedorSalud";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { SectionHeading } from "@/components/shared/SectionHeading";

function semaforoToneFromPct(pct: number | null): "good" | "warn" | "bad" {
  if (pct == null) return "warn";
  if (pct >= 90) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

export function ProveedorSaludTab({ proveedorId }: { proveedorId: string }) {
  const { data, isLoading } = useProveedorSalud(proveedorId);

  if (isLoading || !data) {
    return <KpiGridSkeleton count={6} heightClass="h-24" desktopCols={3} />;
  }

  const tonePct = semaforoToneFromPct(data.pct_pagadas_a_tiempo);
  const semaforoLabel =
    tonePct === "good" ? "Excelente puntualidad" :
    tonePct === "warn" ? "Puntualidad media" : "Atención: pagos tardíos";

  return (
    <div className="space-y-4">
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
          sublabel={`${data.facturas_12m} factura${data.facturas_12m === 1 ? "" : "s"}`}
        />
        <KpiCard label="Saldo actual" value={formatCurrency(data.saldo_actual, "MXN")} variant={data.saldo_actual > 0 ? "warning" : "success"} />
        <KpiCard
          label="% Pagadas a tiempo"
          value={data.pct_pagadas_a_tiempo == null ? "—" : `${data.pct_pagadas_a_tiempo.toFixed(0)}%`}
          variant={tonePct === "good" ? "success" : tonePct === "warn" ? "warning" : "destructive"}
        />
        <KpiCard
          label="Días promedio de pago"
          value={data.dias_promedio_pago == null ? "—" : `${data.dias_promedio_pago.toFixed(0)} d`}
        />
        <KpiCard label="Notas de crédito" value={String(data.notas_credito_count)} sublabel={formatCurrency(data.notas_credito_monto, "MXN")} />
        <KpiCard label="Embarques activos" value={String(data.embarques_activos)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="text-sm font-semibold mb-3">Gasto mensual (últimos 12 meses)</p>
          {data.mensual.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Sin facturación en el período.</p>
          ) : (
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={data.mensual}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="mes" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v, "MXN")} />
                  <Tooltip
                    formatter={(v: number) => formatCurrency(v, "MXN")}
                    labelFormatter={(l) => `Mes ${l}`}
                  />
                  <Bar dataKey="monto" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
