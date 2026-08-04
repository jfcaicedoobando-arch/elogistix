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
import { KpiCard } from "@/components/shared/KpiCard";
import { formatCurrencyCompact, formatFechaEs } from "@/lib/formatters";
import { useDashboardEjecutivoFacturacion } from "@/features/facturacion/hooks/useDashboardEjecutivoFacturacion";
import { useCobranza } from "@/features/facturacion/hooks/useCobranza";

import { useProformasListasCount } from "@/features/facturacion/hooks/useProformasListas";
import { MiniSerie } from "./DashboardEjecutivoFacturacionMiniSerie";
import { mesLabel } from "./DashboardEjecutivoFacturacionMiniSerie.helpers";

interface FacturadoUi { label: string; tone: "warn" | "default"; hint: string }

/**
 * R8: el KPI decía "Facturado mes" y un MXN 0 se leía como error. Nombramos el
 * mes en curso para que un cero se entienda como "todavía no hay actividad".
 */
function mesEnCurso(): string {
  return formatFechaEs(new Date().toISOString(), { month: "long" });
}

function buildFacturadoUi(facturasSinTc: number, mes: string): FacturadoUi {
  const sinTc = facturasSinTc > 0;
  const base = `Facturado en ${mes}`;
  return {
    label: sinTc ? `${base} ⚠️` : base,
    tone: sinTc ? "warn" : "default",
    hint: sinTc
      ? `Facturas timbradas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (o TC del día como fallback). Excluye canceladas y borradores. ⚠️ ${facturasSinTc} factura(s) USD con TC inválido (vacío o ≤1) y sin TC del día disponible están excluidas — corrige el TC en cada factura para que cuadre.`
      : "Facturas timbradas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (TC inválido como ≤1 se reemplaza con el TC del día). Excluye canceladas y borradores. En la tabla de Emitidas usa el preset 'Este mes' para cuadrar.",
  };
}


export function DashboardEjecutivoFacturacion() {
  const dash = useDashboardEjecutivoFacturacion();
  const { kpis: cob } = useCobranza({ estatus: "todos", moneda: "todas" });
  const { data: proformasListas = 0 } = useProformasListasCount();

  const facturadoMes = dash.data?.facturado_mes_mxn ?? 0;
  const cobradoMes = dash.data?.cobrado_mes_mxn ?? 0;
  const porCobrar = cob.total_mxn;
  const vencido = cob.vencido_mxn;

  const tendencia = dash.data?.tendencia ?? [];
  const facturadoArr = tendencia.map((t) => t.facturado_mxn);
  const cobradoArr = tendencia.map((t) => t.cobrado_mxn);
  const meses = tendencia.map((t) => mesLabel(t.mes));

  const mes = mesEnCurso();
  const facturado = buildFacturadoUi(dash.data?.facturas_sin_tc ?? 0, mes);
  const listasTone: "warn" | "default" = proformasListas > 0 ? "warn" : "default";

  return (
    <div className="space-y-2">
      {/* 5 KPIs ejecutivos con la card canónica del UI kit. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Listas para facturar"
          value={proformasListas === 1 ? "1 proforma" : `${proformasListas} proformas`}
          variant={listasTone === "warn" ? "warning" : "default"}
          valueTooltip="Proformas aceptadas por el cliente y sin factura emitida — listas para timbrar. Se convierten desde la bandeja 'Proformas listas'."
        />
        <KpiCard
          label={facturado.label}
          value={formatCurrencyCompact(facturadoMes, "MXN")}
          variant={facturado.tone === "warn" ? "warning" : "default"}
          valueTooltip={facturado.hint}
        />
        <KpiCard
          label={`Cobrado en ${mes}`}
          value={formatCurrencyCompact(cobradoMes, "MXN")}
          variant="success"
          valueTooltip="Pagos aplicados a facturas durante el mes en curso, en MXN equivalente. Un cero significa que aún no se registran cobros este mes."
        />
        <KpiCard
          label="Saldo por cobrar"
          value={formatCurrencyCompact(porCobrar, "MXN")}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Es el mismo universo de la pestaña 'Por cobrar'."
        />

        <KpiCard
          label={`Vencido (${cob.facturas_vencidas})`}
          value={formatCurrencyCompact(vencido, "MXN")}
          variant="destructive"
        />
      </div>

      {tendencia.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-label text-muted-foreground uppercase tracking-wide mb-2">
              Tendencia · Últimos 6 meses (MXN)
            </p>
            <div className="flex items-start gap-6">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}

