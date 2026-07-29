/**
 * /crm/analitica — Vista única (sin sub-tabs). Forecast, embudo, pérdidas y
 * leaderboard apilados verticalmente.
 *
 * Mantiene compatibilidad con el query param `?tab=…` previo: simplemente lo
 * ignora (los enlaces viejos siguen aterrizando aquí).
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CrmSubheader } from "@/features/crm/components/CrmSubheader";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useForecast, useReportesCRM } from "@/features/crm/hooks";
import LeaderboardVendedores from "@/features/crm/components/LeaderboardVendedores";
import { usePermissions, useDocumentTitle } from "@/hooks/shared";
import { PageHeader } from "@/components/shared/PageHeader";
import { PageContainer } from "@/components/shared/PageContainer";

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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por mes</CardTitle></CardHeader>
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
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por vendedor</CardTitle></CardHeader>
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

function EmbudoYPerdidas() {
  const { data, isLoading } = useReportesCRM();
  const r = data ?? { embudo: [], porFuente: [], motivosPerdida: [] };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Embudo</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? "…" : r.embudo.map((e) => (
            <div key={e.etapa} className="flex justify-between py-1 text-sm border-b last:border-0">
              <span>{e.etapa}</span><span className="font-semibold tabular-nums">{e.cantidad}</span>
            </div>
          ))}
          {!isLoading && r.embudo.length === 0 && <p className="text-sm text-muted-foreground">Sin datos</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Conversión por fuente</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="text-xs text-muted-foreground border-b">
              <th className="text-left py-1">Fuente</th><th className="text-right">Total</th><th className="text-right">Conv.</th><th className="text-right">Tasa</th>
            </tr></thead>
            <tbody>
              {r.porFuente.map((f) => (
                <tr key={f.fuente} className="border-b">
                  <td className="py-1">{f.fuente}</td>
                  <td className="text-right tabular-nums">{f.total}</td>
                  <td className="text-right tabular-nums">{f.convertidos}</td>
                  <td className="text-right tabular-nums">{f.tasa.toFixed(1)}%</td>
                </tr>
              ))}
              {r.porFuente.length === 0 && <tr><td colSpan={4} className="text-center text-muted-foreground py-2">Sin datos</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Motivos de pérdida</CardTitle></CardHeader>
        <CardContent>
          {r.motivosPerdida.map((m) => (
            <div key={m.motivo} className="flex justify-between py-1 text-sm border-b last:border-0">
              <span>{m.motivo}</span><span className="font-semibold tabular-nums">{m.cantidad}</span>
            </div>
          ))}
          {r.motivosPerdida.length === 0 && <p className="text-sm text-muted-foreground">Sin oportunidades perdidas</p>}
        </CardContent>
      </Card>
    </div>
  );
}

export default function Analitica() {
  useDocumentTitle("Analítica CRM");
  const { canEdit } = usePermissions();
  return (
    <PageContainer>
      <PageHeader
        title="Analítica CRM"
        description="Forecast, embudo de conversión y rendimiento por vendedor"
      />
      <CrmSubheader context="Forecast · Embudo · Pérdidas · Vendedores" />
      <ForecastPanel />
      <EmbudoYPerdidas />
      {canEdit && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Vendedores</CardTitle></CardHeader>
          <CardContent><LeaderboardVendedores /></CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
