/**
 * Tendencia 12 meses (Ola 4): comprometido vs facturado vs pagado, en MXN.
 */
import { Card, CardContent } from "@/components/ui/card";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import { formatCurrency, formatCompactNumber } from "@/lib/formatters";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { LineChart as LineChartIcon } from "lucide-react";
import { CHART } from "@/lib/chartTokens";
import type { PuntoTendencia } from "@/features/proveedor/domain/inteligenciaProveedor";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function etiquetaMes(mes: string): string {
  const [anio, m] = mes.split("-");
  const idx = Number(m) - 1;
  if (!MESES[idx]) return mes;
  return `${MESES[idx]} ${anio.slice(2)}`;
}

export function ProveedorTendenciaChart({ tendencia }: { tendencia: PuntoTendencia[] }) {
  const hayDatos = tendencia.length >= 2 && tendencia.some((p) => p.comprometido > 0 || p.facturado > 0 || p.pagado > 0);
  const data = tendencia.map((p) => ({ ...p, etiqueta: etiquetaMes(p.mes) }));
  const totalComprometido = tendencia.reduce((acc, p) => acc + p.comprometido, 0);
  const totalFacturado = tendencia.reduce((acc, p) => acc + p.facturado, 0);
  const totalPagado = tendencia.reduce((acc, p) => acc + p.pagado, 0);

  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm font-semibold">Comprometido vs facturado vs pagado</p>
        <p className="text-xs text-muted-foreground mb-3">
          Últimos 12 meses, en pesos. El rezago entre las barras muestra qué tanto tarda el proveedor en facturar y qué tanto tardamos en pagarle.
        </p>
        {!hayDatos ? (
          <EmptyStateInline icon={LineChartIcon} message="No hay suficientes datos para graficar la tendencia." hint="Se necesitan al menos 2 meses con movimientos." />
        ) : (
          <>
          <p className="text-2xs text-muted-foreground mb-1">MXN</p>
          <div
            className="w-full h-72"
            role="img"
            aria-label={`Gráfica de barras, últimos ${tendencia.length} meses en pesos: comprometido ${formatCurrency(totalComprometido, "MXN")}, facturado ${formatCurrency(totalFacturado, "MXN")}, pagado ${formatCurrency(totalPagado, "MXN")}. El detalle por mes sigue a la gráfica.`}
          >
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => formatCompactNumber(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v, "MXN")} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar name="Comprometido" dataKey="comprometido" fill={CHART.neutral} radius={[3, 3, 0, 0]} />
                <Bar name="Facturado" dataKey="facturado" fill={CHART.primary} radius={[3, 3, 0, 0]} />
                <Bar name="Pagado" dataKey="pagado" fill={CHART.success} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="sr-only">
            {data.map((p) => (
              <li key={p.mes}>
                {`${p.etiqueta}: comprometido ${formatCurrency(p.comprometido, "MXN")}, facturado ${formatCurrency(p.facturado, "MXN")}, pagado ${formatCurrency(p.pagado, "MXN")}`}
              </li>
            ))}
          </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
