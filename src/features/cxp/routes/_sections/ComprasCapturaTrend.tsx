/**
 * Tendencia de captura de facturas de proveedor — últimos 14 días.
 * v13.307.22 — reutiliza el listado ya cargado por `useFacturasCxP` para evitar
 * un query extra. Muestra ritmo de captura del equipo contable.
 */
import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { hoyMx } from "@/lib/date/mx";

export interface CapturaTrendRow { fecha_emision: string | null }

export function ComprasCapturaTrend({ rows }: { rows: CapturaTrendRow[] }) {
  const data = useMemo(() => {
    const today = new Date(hoyMx() + "T00:00:00");
    const bucket = new Map<string, number>();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      bucket.set(d.toISOString().slice(0, 10), 0);
    }
    for (const r of rows) {
      if (!r.fecha_emision) continue;
      const key = r.fecha_emision.slice(0, 10);
      if (bucket.has(key)) bucket.set(key, (bucket.get(key) ?? 0) + 1);
    }
    return Array.from(bucket.entries()).map(([k, v]) => {
      const [, m, d] = k.split("-");
      return { label: `${d}/${m}`, capturadas: v };
    });
  }, [rows]);

  const total = data.reduce((s, x) => s + x.capturadas, 0);
  const promedio = Math.round((total / data.length) * 10) / 10;

  return (
    <Card className="h-full">
      <CardHeader className="pb-2 space-y-0">
        <CardTitle>Captura últimos 14 días</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5 tabular-nums">
          {total} facturas · promedio {promedio}/día
        </p>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="cxp-captura-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} interval={1} />
              <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} width={24} allowDecimals={false} />
              <RTooltip
                contentStyle={{
                  background: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 6,
                  fontSize: 12,
                }}
                formatter={(v: number) => [v, "Facturas"]}
              />
              <Area type="monotone" dataKey="capturadas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#cxp-captura-fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
