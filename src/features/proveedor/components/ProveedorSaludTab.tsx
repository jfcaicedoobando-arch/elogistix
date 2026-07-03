/**
 * Scorecard de salud del proveedor — pestaña dentro del detalle de proveedor.
 * Consume la RPC `proveedor_salud`.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import { useProveedorSalud } from "@/features/cxp/hooks/useProveedorSalud";
import { formatCurrency, formatCurrencyCompact } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "warn" | "bad" }) {
  const toneCls = tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-semibold tabular-nums mt-1", toneCls)}>{value}</p>
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function semaforoToneFromPct(pct: number | null): "good" | "warn" | "bad" {
  if (pct == null) return "warn";
  if (pct >= 90) return "good";
  if (pct >= 70) return "warn";
  return "bad";
}

export function ProveedorSaludTab({ proveedorId }: { proveedorId: string }) {
  const { data, isLoading } = useProveedorSalud(proveedorId);

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((indice) => <Skeleton key={indice} className="h-24 w-full" />)}
      </div>
    );
  }

  const tonePct = semaforoToneFromPct(data.pct_pagadas_a_tiempo);
  const semaforoLabel =
    tonePct === "good" ? "Excelente puntualidad" :
    tonePct === "warn" ? "Puntualidad media" : "Atención: pagos tardíos";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Salud del proveedor</h2>
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
        <Kpi label="Facturas últimos 12m" value={String(data.facturas_12m)} sub={formatCurrencyCompact(data.monto_12m, "MXN")} />
        <Kpi label="Saldo actual" value={formatCurrency(data.saldo_actual, "MXN")} tone={data.saldo_actual > 0 ? "warn" : "good"} />
        <Kpi
          label="% Pagadas a tiempo"
          value={data.pct_pagadas_a_tiempo == null ? "—" : `${data.pct_pagadas_a_tiempo.toFixed(0)}%`}
          tone={tonePct}
        />
        <Kpi
          label="Días promedio de pago"
          value={data.dias_promedio_pago == null ? "—" : `${data.dias_promedio_pago.toFixed(0)} d`}
        />
        <Kpi label="Notas de crédito" value={String(data.notas_credito_count)} sub={formatCurrency(data.notas_credito_monto, "MXN")} />
        <Kpi label="Embarques activos" value={String(data.embarques_activos)} />
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
