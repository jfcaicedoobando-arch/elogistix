/**
 * Gráfica de aging (cubetas 0/30/60/90+) — reemplaza los KPIs redundantes de
 * "Vencidas" / "Vencido >30" / "Por vencer 7d" con una vista ejecutiva única.
 * v13.307.22 — Wave "dashboard-compras-visual".
 */
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { ArrowUpRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrencyCompact, formatCurrency } from "@/lib/formatters";
import { ROUTES } from "@/constants/routes";
import type { CxpAgingTotals } from "@/features/cxp/services/cxpAging";

type Bucket = { label: string; monto: number; tone: "success" | "info" | "warn" | "danger" | "critical" };

const TONE_HEX: Record<Bucket["tone"], string> = {
  success: "hsl(var(--muted-foreground) / 0.55)",
  info: "hsl(199 89% 48%)",
  warn: "hsl(38 92% 50%)",
  danger: "hsl(var(--destructive))",
  critical: "hsl(0 84% 45%)",
};

export function ComprasAgingChart({ totales, moneda = "MXN" }: { totales: CxpAgingTotals; moneda?: string }) {
  const data: Bucket[] = [
    { label: "Vigente", monto: totales.vigente, tone: "success" },
    { label: "1–30 d", monto: totales.d_1_30, tone: "info" },
    { label: "31–60 d", monto: totales.d_31_60, tone: "warn" },
    { label: "61–90 d", monto: totales.d_61_90, tone: "danger" },
    { label: ">90 d", monto: totales.mas_90, tone: "critical" },
  ];
  const total = totales.total;
  const vencido = total - totales.vigente;
  const pctVencido = total > 0 ? Math.round((vencido / total) * 100) : 0;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 flex-row items-start justify-between gap-2 space-y-0">
        <div className="min-w-0">
          <CardTitle className="text-sm">Antigüedad de saldos · {moneda}</CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
            {formatCurrencyCompact(vencido, moneda)} vencido de {formatCurrencyCompact(total, moneda)} · {pctVencido}%
          </p>
        </div>
        <Link
          to={ROUTES.COMPRAS_AGING}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          Ver detalle <ArrowUpRight className="h-3 w-3" />
        </Link>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => formatCurrencyCompact(Number(v), "MXN")}
                width={60}
              />
              <RTooltip
                cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                labelStyle={{ color: "hsl(var(--foreground))", fontWeight: 500 }}
                formatter={(v: number) => [formatCurrency(Number(v), "MXN"), "Saldo"]}
              />
              <Bar dataKey="monto" radius={[4, 4, 0, 0]}>
                {data.map((d) => <Cell key={d.label} fill={TONE_HEX[d.tone]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
