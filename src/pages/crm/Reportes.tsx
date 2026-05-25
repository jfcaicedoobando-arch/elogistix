/**
 * /crm/reportes — Embudo, conversión por fuente y motivos de pérdida.
 */
import { BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/PageHeader";
import { useReportesCRM } from "@/hooks/crm/useForecastReportes";

export default function ReportesCRM() {
  const { data, isLoading } = useReportesCRM();
  const r = data ?? { embudo: [], porFuente: [], motivosPerdida: [] };

  return (
    <div className="space-y-6 p-6">
      <PageHeader icon={<BarChart3 className="h-6 w-6 text-primary" />} title="Reportes CRM" description="Embudo, conversión y pérdidas" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Embudo (oportunidades por etapa)</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? "…" : r.embudo.map((e) => (
              <div key={e.etapa} className="flex justify-between py-1 text-sm border-b">
                <span>{e.etapa}</span><span className="font-semibold">{e.cantidad}</span>
              </div>
            ))}
            {!isLoading && r.embudo.length === 0 && <p className="text-sm text-muted-foreground">Sin datos</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Conversión por fuente</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead><tr className="text-xs text-muted-foreground border-b">
                <th className="text-left py-1">Fuente</th><th className="text-right">Total</th><th className="text-right">Conv.</th><th className="text-right">Tasa</th>
              </tr></thead>
              <tbody>
                {r.porFuente.map((f) => (
                  <tr key={f.fuente} className="border-b">
                    <td className="py-1">{f.fuente}</td>
                    <td className="text-right">{f.total}</td>
                    <td className="text-right">{f.convertidos}</td>
                    <td className="text-right">{f.tasa.toFixed(1)}%</td>
                  </tr>
                ))}
                {r.porFuente.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-2">Sin datos</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-sm">Top motivos de pérdida</CardTitle></CardHeader>
          <CardContent>
            {r.motivosPerdida.map((m) => (
              <div key={m.motivo} className="flex justify-between py-1 text-sm border-b">
                <span>{m.motivo}</span><span className="font-semibold">{m.cantidad}</span>
              </div>
            ))}
            {r.motivosPerdida.length === 0 && <p className="text-sm text-muted-foreground">Sin oportunidades perdidas</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
