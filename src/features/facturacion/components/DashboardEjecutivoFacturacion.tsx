/**
 * Card superior del módulo Facturación: 5 KPIs ejecutivos + mini
 * tendencia de 6 meses (facturado vs cobrado en MXN).
 *
 * v13.95.0 — quitamos el KPI duplicado "Por facturar" (ya vive en la alerta
 * de Hueco de Facturación) y lo reemplazamos por "Por timbrar (#)". La
 * tendencia ahora pone los meses debajo de las barras (legible) y muestra
 * "Sin datos" cuando una serie es 0 en todo el rango.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrencyCompact, formatCurrency } from "@/lib/formatters";
import { useDashboardEjecutivoFacturacion } from "@/features/facturacion/hooks/useDashboardEjecutivoFacturacion";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";
import { useProformasPendientes } from "@/features/embarques/hooks/useProformas";

type Tone = "default" | "success" | "warn" | "danger";

function Kpi({ label, value, tone = "default", hint }: { label: string; value: string; tone?: Tone; hint?: string }) {
  const cls =
    tone === "danger" ? "text-destructive" :
    tone === "warn" ? "text-warning" :
    tone === "success" ? "text-success" :
    "text-foreground";
  const labelNode = hint ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-1 cursor-help">
          {label}
          <span aria-hidden className="opacity-60">ⓘ</span>
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[260px] text-xs">{hint}</TooltipContent>
    </Tooltip>
  ) : label;
  return (
    <div className="flex-1 min-w-[120px] px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{labelNode}</p>
      <p className={`text-lg font-semibold tabular-nums ${cls}`}>{value}</p>
    </div>
  );
}

const NOMBRES_MES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function mesLabel(ymStr: string): string {
  const [, m] = ymStr.split("-");
  const idx = Number.parseInt(m, 10) - 1;
  return NOMBRES_MES[idx] ?? ymStr;
}

function MiniSerie({
  titulo,
  data,
  meses,
  colorClass,
}: {
  titulo: string;
  data: number[];
  meses: string[];
  colorClass: string;
}) {
  const max = Math.max(0, ...data);
  const hayDatos = max > 0;
  return (
    <div className="flex flex-col gap-1 min-w-[100px]">
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{titulo}</div>
      {hayDatos ? (
        <>
          <div className="flex items-end gap-1 h-6">
            {data.map((v, i) => {
              const h = Math.max(2, Math.round((v / max) * 24));
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className={`w-2.5 rounded-sm ${colorClass}`} style={{ height: `${h}px` }} />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">
                    {meses[i]}: {formatCurrency(v, "MXN")}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex gap-1">
            {meses.map((m, i) => (
              <span key={i} className="w-2.5 text-center text-[8px] text-muted-foreground leading-none">
                {m.charAt(0)}
              </span>
            ))}
          </div>
        </>
      ) : (
        <div className="h-6 flex items-center text-[10px] italic text-muted-foreground">Sin datos</div>
      )}
    </div>
  );
}

export function DashboardEjecutivoFacturacion() {
  const dash = useDashboardEjecutivoFacturacion();
  const { kpis: cob } = useCobranza({ estatus: "todos", moneda: "todas" });
  const { data: proformasPendientes = [] } = useProformasPendientes();

  const facturadoMes = dash.data?.facturado_mes_mxn ?? 0;
  const cobradoMes = dash.data?.cobrado_mes_mxn ?? 0;
  const porCobrar = cob.total_mxn;
  const vencido = cob.vencido_mxn;
  const porTimbrar = proformasPendientes.length;

  const tendencia = dash.data?.tendencia ?? [];
  const facturadoArr = tendencia.map((t) => t.facturado_mxn);
  const cobradoArr = tendencia.map((t) => t.cobrado_mxn);
  const meses = tendencia.map((t) => mesLabel(t.mes));

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardContent className="p-3">
          <div className="flex flex-col lg:flex-row lg:items-center lg:divide-x divide-border gap-2 lg:gap-0">
            <Kpi
              label="Por timbrar"
              value={porTimbrar.toString()}
              tone={porTimbrar > 0 ? "warn" : "default"}
            />
            <Kpi
              label="Facturado mes"
              value={formatCurrencyCompact(facturadoMes, "MXN")}
              hint="Facturas emitidas en el mes en curso, convertidas a MXN con el tipo de cambio de cada factura. Excluye canceladas. En la tabla de Emitidas usa el preset 'Este mes' para cuadrar."
            />
            <Kpi label="Cobrado mes" value={formatCurrencyCompact(cobradoMes, "MXN")} tone="success" />
            <Kpi label="Por cobrar" value={formatCurrencyCompact(porCobrar, "MXN")} />
            <Kpi
              label={`Vencido (${cob.facturas_vencidas})`}
              value={formatCurrencyCompact(vencido, "MXN")}
              tone="danger"
            />

            {tendencia.length > 0 && (
              <div className="px-3 py-2 lg:border-l border-border">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">
                  Últimos 6 meses · MXN
                </p>
                <div className="flex items-start gap-4">
                  <MiniSerie
                    titulo="Facturado"
                    data={facturadoArr}
                    meses={meses}
                    colorClass="bg-primary/70"
                  />
                  <MiniSerie
                    titulo="Cobrado"
                    data={cobradoArr}
                    meses={meses}
                    colorClass="bg-success/70"
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
