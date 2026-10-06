import { formatNumber, formatCurrency } from "@/lib/formatters";
/**
 * Dibuja los datos de un reporte dinámico según su tipo de gráfica.
 * Colores con tokens semánticos (hsl(var(--...))) para respetar el tema.
 */
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MedidaReporte, ReporteDato, TipoGrafica } from "@/features/crm/services/reportes/tiposReportes";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { DataTable, defineColumns } from "@/components/shared/DataTable";
import { ChartTooltip } from "@/components/shared/ChartTooltip";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { CHART, CHART_SERIES, CHART_TICK, CHART_BAR_RADIUS } from "@/lib/chartTokens";

interface Props {
  tipo: TipoGrafica;
  datos: ReporteDato[];
  medida: MedidaReporte;
}

function formatoValor(v: number, medida: MedidaReporte): string {
  if (medida === "suma_monto_usd") {
    return formatCurrency(v, "USD", { decimals: 0 });
  }
  return formatNumber(v, { minimumFractionDigits: 0, maximumFractionDigits: 3 });
}

export function GraficaReporte({ tipo, datos, medida }: Props) {
  if (datos.length === 0) {
    return <EmptyStateInline message="Sin datos con ese filtro." />;
  }

  if (tipo === "numero") {
    const total = datos.reduce((acc, d) => acc + d.valor, 0);
    return (
      <p className="py-6 text-center text-kpi font-bold tabular-nums text-foreground">
        {formatoValor(total, medida)}
      </p>
    );
  }

  if (tipo === "tabla") {
    return (
      <DataTable data={datos} rowKey={(d) => d.etiqueta} density={TABLE_DENSITY.embebida}
        tableClassName="w-full" columns={defineColumns<ReporteDato>([
          { id: "grupo", header: "Grupo", accessorFn: (d) => d.etiqueta },
          { id: "valor", header: "Valor", accessorFn: (d) => d.valor,
            cell: ({ row }) => formatoValor(row.original.valor, medida), meta: { align: "right", className: "tabular-nums" } },
        ])} />
    );
  }

  if (tipo === "pastel") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={45} outerRadius={80} label={(p) => p.name}>
            {datos.map((d, i) => (
              <Cell key={d.etiqueta} fill={CHART_SERIES[i % CHART_SERIES.length]} />
            ))}
          </Pie>
          <Tooltip content={<ChartTooltip formatValue={(v) => formatoValor(v, medida)} />} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === "linea") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <XAxis dataKey="etiqueta" tick={CHART_TICK} />
          <YAxis tick={CHART_TICK} width={48} />
          <Tooltip content={<ChartTooltip formatValue={(v) => formatoValor(v, medida)} />} />
          <Line name="Valor" type="monotone" dataKey="valor" stroke={CHART.primary} strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <XAxis dataKey="etiqueta" tick={CHART_TICK} />
        <YAxis tick={CHART_TICK} width={48} />
        <Tooltip content={<ChartTooltip formatValue={(v) => formatoValor(v, medida)} />} />
        <Bar name="Valor" dataKey="valor" fill={CHART.primary} radius={CHART_BAR_RADIUS} />
      </BarChart>
    </ResponsiveContainer>
  );
}
