/**
 * Sección Rentabilidad: margen 6m + margen por modo.
 */
import { Card } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import {
  Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip,
} from "recharts";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import type { MargenMes, MargenModo } from "@/features/dashboard/direccion/services/tipos";

const MESES_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
function labelMes(ymStr: string): string {
  const m = parseInt(ymStr.slice(5, 7), 10) - 1;
  return MESES_ES[m] ?? ymStr;
}

export function RentabilidadSection({ margen6m, porModo }: { margen6m: MargenMes[]; porModo: MargenModo[] }) {
  const data = margen6m.map((m) => ({ mes: labelMes(m.mes), pct: Number(m.margen_pct.toFixed(1)), raw: m.mes }));
  const actual = margen6m[margen6m.length - 1]?.mes;
  const maxModo = Math.max(1, ...porModo.map((m) => Math.abs(m.margen_pct)));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Card className="p-5 rounded-xl border border-border">
        <p className="text-body font-medium">Margen bruto — últimos 6 meses</p>
        {data.length === 0 ? (
          <EmptyStateInline icon={BarChart3} message="Sin datos de margen en los últimos 6 meses." className="py-6" />
        ) : (
        <div className="h-56 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} fontSize={12} width={40} />
              <Tooltip content={<ChartTooltip formatValue={(v) => `${v}%`} />} />
              <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                {data.map((d) => (
                  <Cell key={d.raw} fill={d.raw === actual ? "hsl(var(--primary))" : "hsl(var(--muted-foreground) / 0.3)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </Card>

      <Card className="p-5 rounded-xl border border-border">
        <p className="text-body font-medium">Margen por modo de transporte (mes actual)</p>
        {porModo.length === 0 ? (
          <EmptyStateInline icon={BarChart3} message="Sin datos del mes." className="py-6" />
        ) : (
          <ul className="mt-4 space-y-3">
            {porModo.map((m) => {
              // VB-21: un modo sin ventas en el mes no tiene margen medible;
              // mostrar "—" en vez de "0.0%" con barra vacía (desbalanceaba la card).
              const sinOperaciones = m.venta_mxn === 0 && m.margen_pct === 0;
              const w = Math.min(100, (Math.abs(m.margen_pct) / maxModo) * 100);
              const color = m.margen_pct < 0 ? "bg-destructive" : "bg-primary";
              return (
                <li key={m.modo}>
                  <div className="flex items-center justify-between text-body">
                    <span>{m.modo}</span>
                    <span className="tabular-nums font-medium">
                      {sinOperaciones ? "—" : `${m.margen_pct.toFixed(1)}%`}
                    </span>
                  </div>
                  {sinOperaciones ? (
                    <p className="mt-1 text-body-sm text-muted-foreground">Sin operaciones en el mes</p>
                  ) : (
                    <div className="mt-1 h-2 rounded bg-muted overflow-hidden">
                      <div className={`h-full ${color}`} style={{ width: `${w}%` }} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
