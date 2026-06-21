/**
 * Card superior del módulo Facturación: 5 KPIs ejecutivos + mini
 * tendencia de 6 meses (facturado vs cobrado en MXN).
 *
 * Combina datos de tres hooks:
 *  - `useDashboardEjecutivoFacturacion` (mes/tendencia)
 *  - `useHuecoFacturacion` (Por facturar)
 *  - `useCobranza` (Por cobrar + Vencido)
 */
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrencyCompact } from "@/lib/formatters";
import { useDashboardEjecutivoFacturacion } from "@/features/facturacion/hooks/useDashboardEjecutivoFacturacion";
import { useHuecoFacturacion } from "@/features/facturacion/hooks/useHuecoFacturacion";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

type Tone = "default" | "success" | "warn" | "danger";

function Kpi({ label, value, tone = "default" }: { label: string; value: string; tone?: Tone }) {
  const cls =
    tone === "danger" ? "text-destructive" :
    tone === "warn" ? "text-warning" :
    tone === "success" ? "text-success" :
    "text-foreground";
  return (
    <div className="flex-1 min-w-[120px] px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

function MiniBars({ data, max }: { data: number[]; max: number; label: string }) {
  return (
    <div className="flex items-end gap-0.5 h-6">
      {data.map((v, i) => {
        const h = max > 0 ? Math.max(2, Math.round((v / max) * 24)) : 2;
        return <div key={i} className="w-1.5 bg-accent/60 rounded-sm" style={{ height: `${h}px` }} />;
      })}
    </div>
  );
}

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(ymStr: string): string {
  const [, m] = ymStr.split("-");
  const idx = Number.parseInt(m, 10) - 1;
  return NOMBRES_MES[idx] ?? ymStr;
}

export function DashboardEjecutivoFacturacion() {
  const dash = useDashboardEjecutivoFacturacion();
  const hueco = useHuecoFacturacion();
  const { kpis: cob } = useCobranza({ estatus: "todos", moneda: "todas" });

  const facturadoMes = dash.data?.facturado_mes_mxn ?? 0;
  const cobradoMes = dash.data?.cobrado_mes_mxn ?? 0;
  const porFacturar = hueco.totalMxn;
  const porCobrar = cob.total_mxn;
  const vencido = cob.vencido_mxn;

  const tendencia = dash.data?.tendencia ?? [];
  const facturadoArr = tendencia.map((t) => t.facturado_mxn);
  const cobradoArr = tendencia.map((t) => t.cobrado_mxn);
  const maxF = Math.max(1, ...facturadoArr);
  const maxC = Math.max(1, ...cobradoArr);

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:divide-x divide-border gap-2 lg:gap-0">
          <Kpi label="Facturado mes" value={formatCurrencyCompact(facturadoMes, "MXN")} />
          <Kpi label="Por facturar" value={formatCurrencyCompact(porFacturar, "MXN")} tone="warn" />
          <Kpi label="Cobrado mes" value={formatCurrencyCompact(cobradoMes, "MXN")} tone="success" />
          <Kpi label="Por cobrar" value={formatCurrencyCompact(porCobrar, "MXN")} />
          <Kpi label={`Vencido (${cob.facturas_vencidas})`} value={formatCurrencyCompact(vencido, "MXN")} tone="danger" />

          {tendencia.length > 0 && (
            <div className="flex-1 min-w-[180px] px-3 py-2 lg:border-l border-border">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Últimos 6 meses · MXN</p>
              <div className="flex items-center gap-3">
                <div>
                  <div className="text-[10px] text-muted-foreground">Facturado</div>
                  <MiniBars data={facturadoArr} max={maxF} label="facturado" />
                </div>
                <div>
                  <div className="text-[10px] text-muted-foreground">Cobrado</div>
                  <MiniBars data={cobradoArr} max={maxC} label="cobrado" />
                </div>
                <div className="text-[10px] text-muted-foreground self-end pb-0.5 hidden xl:block">
                  {tendencia.map((t) => mesLabel(t.mes)).join(" · ")}
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
