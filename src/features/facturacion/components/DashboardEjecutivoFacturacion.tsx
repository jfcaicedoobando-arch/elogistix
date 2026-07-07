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
import { useProformasListasCount } from "@/features/facturacion/hooks/useProformasListas";

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
    <div className="min-w-0 px-3 py-2">
      <p className="text-[11px] text-muted-foreground uppercase tracking-wide truncate">{labelNode}</p>
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
      <div className="text-2xs text-muted-foreground uppercase tracking-wide">{titulo}</div>
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
        <div className="h-6 flex items-center text-2xs italic text-muted-foreground">Sin datos</div>
      )}
    </div>
  );
}

export function DashboardEjecutivoFacturacion() {
  const dash = useDashboardEjecutivoFacturacion();
  const { kpis: cob } = useCobranza({ estatus: "todos", moneda: "todas" });
  const { data: proformasPendientes = [] } = useProformasPendientes();
  const { data: proformasListas = 0 } = useProformasListasCount();

  const facturadoMes = dash.data?.facturado_mes_mxn ?? 0;
  const cobradoMes = dash.data?.cobrado_mes_mxn ?? 0;
  const porCobrar = cob.total_mxn;
  const vencido = cob.vencido_mxn;
  const porRevisar = proformasPendientes.length;

  const tendencia = dash.data?.tendencia ?? [];
  const facturadoArr = tendencia.map((t) => t.facturado_mxn);
  const cobradoArr = tendencia.map((t) => t.cobrado_mxn);
  const meses = tendencia.map((t) => mesLabel(t.mes));

  const facturasSinTc = dash.data?.facturas_sin_tc ?? 0;
  const sinTc = facturasSinTc > 0;
  const facturadoLabel = sinTc ? "Facturado mes ⚠️" : "Facturado mes";
  const facturadoTone: "warn" | "default" = sinTc ? "warn" : "default";
  const facturadoHint = sinTc
    ? `Facturas emitidas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (o TC del día como fallback). Excluye canceladas. ⚠️ ${facturasSinTc} factura(s) USD con TC inválido (vacío o ≤1) y sin TC del día disponible están excluidas — corrige el TC en cada factura para que cuadre.`
    : "Facturas emitidas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (TC inválido como ≤1 se reemplaza con el TC del día). Excluye canceladas. En la tabla de Emitidas usa el preset 'Este mes' para cuadrar.";
  const porRevisarTone: "warn" | "default" = porRevisar > 0 ? "warn" : "default";
  const listasTone: "warn" | "default" = proformasListas > 0 ? "warn" : "default";

  return (
    <TooltipProvider delayDuration={150}>
      <Card>
        <CardContent className="p-3">
          {/*
            6 KPIs (Por revisar, Listas para facturar, Facturado, Cobrado,
            Por cobrar, Vencido) + tendencia. Desktop xl: 7 columnas.
          */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-7 gap-1 xl:gap-0 xl:divide-x xl:divide-border">
            <Kpi
              label="Proformas por revisar"
              value={porRevisar.toString()}
              tone={porRevisarTone}
              hint="Proformas generadas desde embarques que aún no han sido revisadas ni aprobadas internamente (estado 'pendiente'). Una vez aprobadas pasan a 'Listas para facturar'."
            />

            <Kpi
              label="Listas para facturar"
              value={proformasListas.toString()}
              tone={listasTone}
              hint="Proformas aprobadas internamente y sin factura asociada — listas para convertir a CFDI. Se convierten desde la bandeja 'Proformas listas'."
            />

            <Kpi
              label={facturadoLabel}
              value={formatCurrencyCompact(facturadoMes, "MXN")}
              tone={facturadoTone}
              hint={facturadoHint}
            />

            <Kpi label="Cobrado mes" value={formatCurrencyCompact(cobradoMes, "MXN")} tone="success" />
            <Kpi label="Por cobrar" value={formatCurrencyCompact(porCobrar, "MXN")} />
            <Kpi
              label={`Vencido (${cob.facturas_vencidas})`}
              value={formatCurrencyCompact(vencido, "MXN")}
              tone="danger"
            />




            {tendencia.length > 0 && (
              <div className="col-span-2 md:col-span-3 xl:col-span-1 px-3 py-2 xl:border-l border-border border-t xl:border-t-0 mt-1 xl:mt-0 pt-2 xl:pt-2">
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

