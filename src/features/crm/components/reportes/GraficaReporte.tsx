/**
 * Dibuja los datos de un reporte dinámico según su tipo de gráfica.
 * Colores con tokens semánticos (hsl(var(--...))) para respetar el tema.
 */
import { Bar, BarChart, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { MedidaReporte, ReporteDato, TipoGrafica } from "@/features/crm/services/reportes/tiposReportes";

const COLORES_PASTEL = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 210 40% 60%))",
  "hsl(var(--chart-3, 150 40% 50%))",
  "hsl(var(--chart-4, 30 80% 55%))",
  "hsl(var(--chart-5, 340 60% 55%))",
  "hsl(var(--muted-foreground))",
];

interface Props {
  tipo: TipoGrafica;
  datos: ReporteDato[];
  medida: MedidaReporte;
}

function formatoValor(v: number, medida: MedidaReporte): string {
  if (medida === "suma_monto_usd") {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v);
  }
  return new Intl.NumberFormat("es-MX").format(v);
}

export function GraficaReporte({ tipo, datos, medida }: Props) {
  if (datos.length === 0) {
    return <p className="py-8 text-center text-body text-muted-foreground">Sin datos con ese filtro.</p>;
  }

  if (tipo === "numero") {
    const total = datos.reduce((acc, d) => acc + d.valor, 0);
    return (
      <p className="py-6 text-center text-4xl font-bold tabular-nums text-foreground">
        {formatoValor(total, medida)}
      </p>
    );
  }

  if (tipo === "tabla") {
    return (
      <table className="w-full text-body">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-1.5 font-medium">Grupo</th>
            <th className="py-1.5 text-right font-medium">Valor</th>
          </tr>
        </thead>
        <tbody>
          {datos.map((d) => (
            <tr key={d.etiqueta} className="border-b border-border/50 last:border-0">
              <td className="py-1.5 pr-2">{d.etiqueta}</td>
              <td className="py-1.5 text-right tabular-nums">{formatoValor(d.valor, medida)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (tipo === "pastel") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie data={datos} dataKey="valor" nameKey="etiqueta" innerRadius={45} outerRadius={80} label={(p) => p.name}>
            {datos.map((d, i) => (
              <Cell key={d.etiqueta} fill={COLORES_PASTEL[i % COLORES_PASTEL.length]} />
            ))}
          </Pie>
          <Tooltip formatter={(v) => formatoValor(Number(v), medida)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (tipo === "linea") {
    return (
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip formatter={(v) => formatoValor(Number(v), medida)} />
          <Line type="monotone" dataKey="valor" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={datos} margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
        <XAxis dataKey="etiqueta" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip cursor={{ fill: "hsl(var(--muted) / 0.4)" }} formatter={(v) => formatoValor(Number(v), medida)} />
        <Bar dataKey="valor" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
