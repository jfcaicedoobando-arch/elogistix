/**
 * /crm/analitica — Fusión de Forecast + Reportes en una sola pestaña con sub-tabs.
 * Sustituye a /crm/forecast y /crm/reportes (que redirigen aquí).
 */
import { BarChart3 } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useForecast, useReportesCRM } from "@/hooks/crm";
import LeaderboardVendedores from "@/components/crm/LeaderboardVendedores";
import { usePermissions } from "@/hooks/shared";

const fmt = (n: number) => formatCurrencyCompact(n, "MXN");

function ForecastPanel() {
  const { data, isLoading } = useForecast();
  const f = data ?? { porMes: [], porVendedor: [], totalPipeline: 0, totalPonderado: 0, totalGanado: 0 };
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Pipeline</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalPipeline)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ponderado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalPonderado)}</CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Ganado</CardTitle></CardHeader><CardContent className="text-2xl font-bold">{isLoading ? "…" : fmt(f.totalGanado)}</CardContent></Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
    </div>
  );
}

function EmbudoPanel() {
  const { data, isLoading } = useReportesCRM();
  const r = data ?? { embudo: [], porFuente: [], motivosPerdida: [] };
  return (
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
    </div>
  );
}

function PerdidasPanel() {
  const { data } = useReportesCRM();
  const motivos = data?.motivosPerdida ?? [];
  return (
    <Card>
      <CardHeader><CardTitle className="text-sm">Top motivos de pérdida</CardTitle></CardHeader>
      <CardContent>
        {motivos.map((m) => (
          <div key={m.motivo} className="flex justify-between py-1 text-sm border-b">
            <span>{m.motivo}</span><span className="font-semibold">{m.cantidad}</span>
          </div>
        ))}
        {motivos.length === 0 && <p className="text-sm text-muted-foreground">Sin oportunidades perdidas</p>}
      </CardContent>
    </Card>
  );
}

export default function Analitica() {
  const [params, setParams] = useSearchParams();
  const { canEdit } = usePermissions();
  const tab = params.get("tab") || "forecast";
  const setTab = (v: string) => { const n = new URLSearchParams(params); n.set("tab", v); setParams(n); };
  return (
    <div className="space-y-6 p-6">
      <PageHeader icon={<BarChart3 className="h-6 w-6 text-primary" />} title="Analítica" description="Forecast, embudo, pérdidas y vendedores" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="forecast">Forecast</TabsTrigger>
          <TabsTrigger value="embudo">Embudo</TabsTrigger>
          <TabsTrigger value="perdidas">Pérdidas</TabsTrigger>
          {canEdit && <TabsTrigger value="vendedores">Vendedores</TabsTrigger>}
        </TabsList>
        <TabsContent value="forecast" className="mt-4"><ForecastPanel /></TabsContent>
        <TabsContent value="embudo" className="mt-4"><EmbudoPanel /></TabsContent>
        <TabsContent value="perdidas" className="mt-4"><PerdidasPanel /></TabsContent>
        {canEdit && <TabsContent value="vendedores" className="mt-4"><LeaderboardVendedores /></TabsContent>}
      </Tabs>
    </div>
  );
}
