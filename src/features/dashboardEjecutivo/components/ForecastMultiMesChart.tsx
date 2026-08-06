/**
 * ForecastMultiMesChart — visualiza los últimos meses reales de EERR (barras)
 * más N meses proyectados (línea + banda de confianza).
 *
 * v13.300.33 · Batch F · forecast multi-mes
 */
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, Area, XAxis, YAxis,
  Tooltip, Legend, CartesianGrid,
} from "recharts";
import { formatCurrencyCompact } from "@/lib/formatters/numbers";
import { computeForecast } from "@/features/dashboardEjecutivo/domain/forecast";
import type { PuntoEERR } from "@/features/dashboardEjecutivo/services";

interface Props {
  historico: PuntoEERR[];
  mesesAdelante?: number;
}

export function ForecastMultiMesChart({ historico, mesesAdelante = 3 }: Props) {
  const data = computeForecast(historico, mesesAdelante);
  const suficiente = historico.length >= 3;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle >Forecast de ingresos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Meses reales + proyección {mesesAdelante} meses (promedio móvil 3m, banda ±15%).
        </p>
      </CardHeader>
      <CardContent>
        {!suficiente ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Se requieren al menos 3 meses de historia para proyectar.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="periodo" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrencyCompact(v, "MXN")} />
                <Tooltip
                  formatter={(v: unknown) => (typeof v === "number" ? formatCurrencyCompact(v, "MXN") : "—")}
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area
                  type="monotone"
                  dataKey="banda_max"
                  stroke="none"
                  fill="hsl(var(--accent))"
                  fillOpacity={0.15}
                  name="Banda +15%"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="banda_min"
                  stroke="none"
                  fill="hsl(var(--background))"
                  fillOpacity={1}
                  name="Banda -15%"
                  isAnimationActive={false}
                />
                <Bar dataKey="ingresos" name="Ingresos reales" fill="hsl(var(--primary))" />
                <Line
                  type="monotone"
                  dataKey="proyeccion"
                  name="Proyección"
                  stroke="hsl(var(--accent))"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  dot={{ r: 3 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
