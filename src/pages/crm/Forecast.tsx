/**
 * /crm/forecast — Forecast comercial agregado por mes y vendedor.
 */
import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useForecast } from "@/hooks/crm/useForecastReportes";

const fmt = (n: number) => formatCurrencyCompact(n, "MXN");

export default function Forecast() {
  const { data, isLoading } = useForecast();
  const f = data ?? { porMes: [], porVendedor: [], totalPipeline: 0, totalPonderado: 0, totalGanado: 0 };

  return (
    <div className="space-y-6 p-6">
      <PageHeader icon={<TrendingUp className="h-6 w-6 text-primary" />} title="Forecast" description="Proyección comercial ponderada" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalPipeline)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ponderado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalPonderado)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ganado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalGanado)}</CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Por mes</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left py-2">Mes</th><th className="text-right">Pipeline</th><th className="text-right">Ponderado</th><th className="text-right">Ganado</th><th className="text-right">#</th>
            </tr></thead>
            <tbody>
              {f.porMes.map((b) => (
                <tr key={b.key} className="border-b">
                  <td className="py-1.5">{b.label}</td>
                  <td className="text-right tabular-nums">{fmt(b.pipeline)}</td>
                  <td className="text-right tabular-nums">{fmt(b.ponderado)}</td>
                  <td className="text-right tabular-nums">{fmt(b.ganado)}</td>
                  <td className="text-right">{b.count}</td>
                </tr>
              ))}
              {f.porMes.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Sin datos</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Por vendedor</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left py-2">Vendedor</th><th className="text-right">Pipeline</th><th className="text-right">Ponderado</th><th className="text-right">Ganado</th><th className="text-right">#</th>
            </tr></thead>
            <tbody>
              {f.porVendedor.map((b) => (
                <tr key={b.key} className="border-b">
                  <td className="py-1.5">{b.label}</td>
                  <td className="text-right tabular-nums">{fmt(b.pipeline)}</td>
                  <td className="text-right tabular-nums">{fmt(b.ponderado)}</td>
                  <td className="text-right tabular-nums">{fmt(b.ganado)}</td>
                  <td className="text-right">{b.count}</td>
                </tr>
              ))}
              {f.porVendedor.length === 0 && <tr><td colSpan={5} className="text-center text-muted-foreground py-4">Sin datos</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
