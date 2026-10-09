/**
 * Tab P&L del detalle de embarque. Orquesta sub-componentes KPI/comparativa/proveedores.
 *
 * v13.56.2 — auditoría (paso 5): descompuesto de 289 → ~115 líneas.
 */
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { fmtPnl, pctPnl, deltaPnl, centavosPnl } from "@/lib/formatters/pnl";
import { calcularAlertasPnl, PNL_UMBRAL_MARGEN_MIN_PCT } from "@/features/embarques/domain/pnlAlertas";
import { usePnlFinanciero } from "@/features/embarques/hooks/usePnlFinanciero";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { KpiCard } from "@/components/shared/KpiCard";
import { PnlDetalleFinanciero } from "./pnl/PnlDetalleFinanciero";
import { PnlProveedoresTable } from "./pnl/PnlProveedoresTable";
import { PnlTipoCambioNota } from "./pnl/PnlTipoCambioNota";
import { PnlAvisosCards } from "./pnl/PnlAvisosCards";

interface Props {
  embarqueId: string;
  /** v13.823.366 — En Borrador sin importes reales no se pintan alertas. */
  estadoEmbarque?: string | null;
  monedasExtranjeras?: string[];
}

// eslint-disable-next-line complexity
export function TabPnl({ embarqueId, estadoEmbarque, monedasExtranjeras = [] }: Props) {
  const { data, isLoading, error, refetch } = usePnlFinanciero(embarqueId);
  const { registerRef } = useFocusSection();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <KpiGridSkeleton count={4} heightClass="h-24" />
        <ChartSkeleton height={256} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <ErrorStateInline
        title="No se pudo cargar el P&L del embarque"
        message={(error as Error | null)?.message ?? "Ocurrió un error inesperado. Intenta de nuevo."}
        onRetry={() => void refetch()}
      />
    );
  }

  // P2-7: redondeo a centavos antes de restar, igual que `computeEmbarqueKpis`
  // en el tab Costos. Así Costos y Utilidad muestran la misma cifra y la
  // utilidad mostrada es la resta de la venta y el costo mostrados.
  const ventaReal = data.venta.real_mxn !== null && Number.isFinite(data.venta.real_mxn)
    ? centavosPnl(data.venta.real_mxn) : null;
  const costoReal = data.costo.real_mxn !== null && Number.isFinite(data.costo.real_mxn)
    ? centavosPnl(data.costo.real_mxn) : null;
  const ventaPresup = centavosPnl(data.venta.presupuestada_mxn);
  const costoPresup = centavosPnl(data.costo.presupuestado_mxn);
  const utilidadPresup = centavosPnl(ventaPresup - costoPresup);
  const margenPresup = ventaPresup > 0 ? (utilidadPresup / ventaPresup) * 100 : 0;


  const coberturaNoEvaluada = data.seguros_cobertura?.evaluada !== true;
  const segurosInconsistentes = data.seguros_cobertura?.inconsistentes ?? 0;
  const documentacionNoEvaluada = data.costos_documentacion?.evaluada !== true;
  const conceptosSinDocumentar = data.costos_documentacion?.sin_documentar ?? 0;
  const costosIncompletos = data.estado_costos === "incompleto" || costoReal === null
    || coberturaNoEvaluada || segurosInconsistentes > 0
    || documentacionNoEvaluada || conceptosSinDocumentar > 0;
  const ingresos = data.ingresos_documentacion;
  const ingresosNoEvaluados = ingresos?.evaluada !== true;
  const ingresosIncompletos = data.estado_ingresos !== "completo" || ingresosNoEvaluados || ventaReal === null
    || (ingresos?.notas_credito_sin_base ?? 0) > 0 || (ingresos?.notas_credito_sin_valoracion ?? 0) > 0
    || (ingresos?.facturas_sin_valoracion ?? 0) > 0 || (ingresos?.repartos_provisionales ?? 0) > 0
    || (ingresos?.desbordamientos ?? 0) > 0;
  const actividadIngresos = (ingresos?.facturas ?? 0) > 0 || (ingresos?.notas_credito_activas ?? 0) > 0;
  const dVenta = deltaPnl(ventaReal ?? 0, ventaPresup);
  const dCosto = deltaPnl(costoReal ?? 0, costoPresup);
  const { utilidadReal, margenReal, alertaSobrecosto, alertaVenta, alertaMargen, sinActividadReal } =
    calcularAlertasPnl({
      ventaReal, costoReal, ventaPresup, costoPresup, deltaCostoPct: dCosto.pct, estadoEmbarque, costosIncompletos,
      ingresosIncompletos, actividadIngresos,
    });
  const dUtilidad = deltaPnl(utilidadReal ?? 0, utilidadPresup);

  return (
    <div className="space-y-6">
      <div
        ref={registerRef("utilidad")}
        data-focus="utilidad"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        {/* v13.823.367 — Sin actividad real (Borrador recién creado) los KPI se
            muestran neutrales: sólo presupuesto como contexto, sin Δ ni tonos
            de alerta; pintar Δ −100% sería una pérdida ficticia. */}
        <KpiCard
          label={ingresosIncompletos ? "Venta observada · provisional" : "Venta real"}
          value={ventaReal === null ? "No calculable" : fmtPnl(ventaReal)}
          delta={
            sinActividadReal || ingresosIncompletos
              ? `Presup. ${fmtPnl(ventaPresup)}`
              : `Presup. ${fmtPnl(ventaPresup)} · Δ ${fmtPnl(dVenta.abs)}`
          }
          variant={sinActividadReal || ingresosIncompletos || ventaReal === null ? "default" : ventaReal >= ventaPresup ? "success" : "warning"}
        />
        <KpiCard
          label={costosIncompletos ? "Costo observado · provisional" : "Costo real"}
          value={costoReal === null ? "No calculable" : fmtPnl(costoReal)}
          delta={
            sinActividadReal || costoReal === null
              ? `Presup. ${fmtPnl(costoPresup)}`
              : `Presup. ${fmtPnl(costoPresup)} · Δ ${fmtPnl(dCosto.abs)}`
          }
          variant={alertaSobrecosto ? "destructive" : "default"}
        />
        <KpiCard
          label="Utilidad real"
          value={utilidadReal === null ? "No calculable" : fmtPnl(utilidadReal)}
          delta={
            sinActividadReal || utilidadReal === null
              ? `Presup. ${fmtPnl(utilidadPresup)}`
              : `Presup. ${fmtPnl(utilidadPresup)} · Δ ${fmtPnl(dUtilidad.abs)}`
          }
          variant={sinActividadReal || utilidadReal === null ? "default" : utilidadReal >= utilidadPresup ? "success" : "destructive"}
        />
        <KpiCard
          label="Margen real"
          // UIA-10: sin venta real el margen no es 0%, es indeterminado.
          value={margenReal === null ? "No calculable" : pctPnl(margenReal)}
          delta={`Presup. ${pctPnl(margenPresup)}`}

          variant={
            sinActividadReal || utilidadReal === null || margenReal === null
              ? "default"
              : utilidadReal < 0 || margenReal < 0
                ? "destructive"
                : margenReal < PNL_UMBRAL_MARGEN_MIN_PCT
                  ? "warning"
                  : "success"
          }
        />
      </div>

      <PnlAvisosCards
        sinActividadReal={sinActividadReal}
        costosIncompletos={costosIncompletos}
        ingresosIncompletos={ingresosIncompletos}
        ingresosNoEvaluados={ingresosNoEvaluados}
        ingresos={ingresos}
        notasCreditoSinBase={data.notas_credito_sin_base}
        costoSinAsignar={data.costo_sin_asignar_mxn}
        facturasSobreasignadas={data.facturas_sobreasignadas}
        coberturaNoEvaluada={coberturaNoEvaluada}
        segurosInconsistentes={segurosInconsistentes}
        documentacionNoEvaluada={documentacionNoEvaluada}
        conceptosSinDocumentar={conceptosSinDocumentar}
        alertaSobrecosto={alertaSobrecosto}
        alertaVenta={alertaVenta}
        alertaMargen={alertaMargen}
        dCostoPct={dCosto.pct}
        margenReal={margenReal}
      />

      <PnlDetalleFinanciero data={data} sinActividadReal={sinActividadReal} />

      <div ref={registerRef("comision")} data-focus="comision">
        <PnlProveedoresTable proveedores={data.por_proveedor} />
      </div>

      <PnlTipoCambioNota
        embarqueId={embarqueId}
        tcUsd={data.tipo_cambio_usd}
        tcEur={data.tipo_cambio_eur}
        monedas={monedasExtranjeras}
      />
    </div>
  );
}
