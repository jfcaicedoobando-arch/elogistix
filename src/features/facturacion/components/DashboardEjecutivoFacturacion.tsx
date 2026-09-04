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
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { formatCurrency, formatCurrencyCompact, formatFechaEs } from "@/lib/formatters";
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

/** UIA-03: sublabel con la porción en USD (excluida del total MXN sin TC). */
function sublabelUsd(montoUsd: number): string | undefined {
  return montoUsd > 0 ? `+ ${formatCurrencyCompact(montoUsd, "USD")} en USD` : undefined;
}

function buildFacturadoUi(facturasSinTc: number, mes: string): FacturadoUi {
  const sinTc = facturasSinTc > 0;
  const base = `Facturado en ${mes}`;
  return {
    label: base,
    tone: sinTc ? "warn" : "default",
    hint: sinTc
      ? `Facturas timbradas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (o TC del día como fallback). Excluye canceladas y borradores. Atención: ${facturasSinTc} factura(s) USD con TC inválido (vacío o ≤1) y sin TC del día disponible están excluidas — corrige el TC en cada factura para que cuadre.`
      : "Facturas timbradas del mes en curso, convertidas a MXN con el tipo de cambio de cada factura (TC inválido como ≤1 se reemplaza con el TC del día). Excluye canceladas y borradores. En la tabla de Emitidas usa el preset 'Este mes' para cuadrar.",
  };
}


/** Suprime el monto cuando la consulta falló: "—" en vez de un falso MXN 0. */
function montoMxn(monto: number, hayError: boolean): string {
  return hayError ? "—" : formatCurrency(monto, "MXN");
}

/** Oculta el sublabel USD mientras el dato no sea confiable. */
function subUsdSeguro(montoUsd: number, hayError: boolean): string | undefined {
  return hayError ? undefined : sublabelUsd(montoUsd);
}

/** Mensaje del banner de error según qué consulta falló. */
function mensajeErrorKpis(dashError: boolean, cobError: boolean): string {
  if (dashError && cobError) return "No se pudieron cargar los KPIs de facturación ni los de cobranza.";
  if (dashError) return "No se pudieron cargar los KPIs de facturación del mes.";
  return "No se pudieron cargar los KPIs de cobranza (saldo por cobrar y vencido).";
}

/** Banner de error con reintento para los KPIs del header. */
function BannerErrorKpis({ dashError, cobError, onRetry }: {
  dashError: boolean; cobError: boolean; onRetry: () => void;
}) {
  if (!dashError && !cobError) return null;
  return (
    <ErrorStateInline
      className="py-4"
      message={mensajeErrorKpis(dashError, cobError)}
      onRetry={onRetry}
    />
  );
}

export function DashboardEjecutivoFacturacion() {
  const dash = useDashboardEjecutivoFacturacion();
  const cobranza = useCobranza({ estatus: "todos", moneda: "todas" });
  const cob = cobranza.kpis;
  const { data: proformasListas = 0 } = useProformasListasCount();

  /**
   * Fail-closed: un error de carga NO se pinta como "MXN 0". Se suprime el
   * valor con "—" y se ofrece reintentar arriba de la fila de KPIs.
   */
  const dashError = dash.isError;
  const cobError = cobranza.kpisIsError;

  const facturadoMes = montoMxn(dash.data?.facturado_mes_mxn ?? 0, dashError);
  const cobradoMes = montoMxn(dash.data?.cobrado_mes_mxn ?? 0, dashError);
  const porCobrar = montoMxn(cob.total_mxn, cobError);
  const vencido = montoMxn(cob.vencido_mxn, cobError);
  const subUsdPorCobrar = subUsdSeguro(cob.total_usd, cobError);
  const subUsdVencido = subUsdSeguro(cob.vencido_usd, cobError);
  const labelVencido = cobError ? "Vencido" : `Vencido (${cob.facturas_vencidas})`;

  const tendencia = dash.data?.tendencia ?? [];
  const facturadoArr = tendencia.map((t) => t.facturado_mxn);
  const cobradoArr = tendencia.map((t) => t.cobrado_mxn);
  const meses = tendencia.map((t) => mesLabel(t.mes));

  const mes = mesEnCurso();
  const facturado = buildFacturadoUi(dash.data?.facturas_sin_tc ?? 0, mes);
  const facturadoVariant = facturado.tone === "warn" ? "warning" : "default";
  const listasVariant = proformasListas > 0 ? "warning" : "default";
  const listasValue = proformasListas === 1 ? "1 proforma" : `${proformasListas} proformas`;

  return (
    <div className="space-y-2">
      <BannerErrorKpis
        dashError={dashError}
        cobError={cobError}
        onRetry={() => {
          if (dashError) void dash.refetch();
          if (cobError) cobranza.kpisRefetch();
        }}
      />
      {/* 5 KPIs ejecutivos con la card canónica del UI kit. */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
        <KpiCard
          label="Listas para facturar"
          value={listasValue}
          variant={listasVariant}
          valueTooltip="Proformas aceptadas por el cliente y sin factura emitida — listas para timbrar. Se convierten desde la bandeja 'Proformas listas'."
        />
        {/* VF-05: montos completos con moneda en KPIs financieros; la
            abreviatura "MXN 48.7K" convivía con montos completos en la misma
            pantalla y se leía como inconsistencia de formato. */}
        <KpiCard
          label={facturado.label}
          value={facturadoMes}
          variant={facturadoVariant}
          valueTooltip={facturado.hint}
        />
        <KpiCard
          label={`Cobrado en ${mes}`}
          value={cobradoMes}
          variant="success"
          valueTooltip="Pagos aplicados a facturas durante el mes en curso, en MXN equivalente. Un cero significa que aún no se registran cobros este mes."
        />
        <KpiCard
          label="Saldo por cobrar"
          value={porCobrar}
          sublabel={subUsdPorCobrar}
          valueTooltip="Saldo total pendiente de cobro de todas las facturas vivas (no sólo del mes en curso). Las facturas en USD se muestran aparte para no mezclar monedas sin tipo de cambio."
        />

        <KpiCard
          label={labelVencido}
          value={vencido}
          sublabel={subUsdVencido}
          variant="destructive"
        />
      </div>

      {tendencia.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <p className="text-overline mb-2">
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

