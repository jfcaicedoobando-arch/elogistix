/**
 * Tab P&L del detalle de embarque. Orquesta sub-componentes KPI/comparativa/proveedores.
 *
 * v13.56.2 — auditoría (paso 5): descompuesto de 289 → ~115 líneas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { ErrorStateInline } from "@/components/empty/ErrorStateInline";
import { fmtPnl, pctPnl, deltaPnl } from "@/lib/formatters/pnl";
import { calcularAlertasPnl, PNL_UMBRAL_MARGEN_MIN_PCT } from "@/features/embarques/domain/pnlAlertas";
import { usePnlFinanciero } from "@/features/embarques/hooks/usePnlFinanciero";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { KpiCard } from "@/components/shared/KpiCard";
import { PnlComparativaTable } from "./pnl/PnlComparativaTable";
import { PnlProveedoresTable } from "./pnl/PnlProveedoresTable";
import { PnlTipoCambioNota } from "./pnl/PnlTipoCambioNota";
import { PnlAvisosCards } from "./pnl/PnlAvisosCards";

interface Props {
  embarqueId: string;
  /** v13.823.366 — En Borrador sin importes reales no se pintan alertas. */
  estadoEmbarque?: string | null;
}

// eslint-disable-next-line complexity
export function TabPnl({ embarqueId, estadoEmbarque }: Props) {
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

  const ventaReal = data.venta.real_mxn;
  const costoReal = data.costo.real_mxn;
  const ventaPresup = data.venta.presupuestada_mxn;
  const costoPresup = data.costo.presupuestado_mxn;
  const utilidadPresup = ventaPresup - costoPresup;
  const margenPresup = ventaPresup > 0 ? (utilidadPresup / ventaPresup) * 100 : 0;

  const dVenta = deltaPnl(ventaReal, ventaPresup);
  const dCosto = deltaPnl(costoReal, costoPresup);
  const { utilidadReal, margenReal, alertaSobrecosto, alertaVenta, alertaMargen, sinActividadReal } =
    calcularAlertasPnl({
      ventaReal, costoReal, ventaPresup, costoPresup, deltaCostoPct: dCosto.pct, estadoEmbarque,
    });
  const dUtilidad = deltaPnl(utilidadReal, utilidadPresup);

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
          label="Venta real"
          value={fmtPnl(ventaReal)}
          delta={
            sinActividadReal
              ? `Presup. ${fmtPnl(ventaPresup)}`
              : `Presup. ${fmtPnl(ventaPresup)} · Δ ${fmtPnl(dVenta.abs)}`
          }
          variant={sinActividadReal ? "default" : ventaReal >= ventaPresup ? "success" : "warning"}
        />
        <KpiCard
          label="Costo real"
          value={fmtPnl(costoReal)}
          delta={
            sinActividadReal
              ? `Presup. ${fmtPnl(costoPresup)}`
              : `Presup. ${fmtPnl(costoPresup)} · Δ ${fmtPnl(dCosto.abs)}`
          }
          variant={alertaSobrecosto ? "destructive" : "default"}
        />
        <KpiCard
          label="Utilidad real"
          value={fmtPnl(utilidadReal)}
          delta={
            sinActividadReal
              ? `Presup. ${fmtPnl(utilidadPresup)}`
              : `Presup. ${fmtPnl(utilidadPresup)} · Δ ${fmtPnl(dUtilidad.abs)}`
          }
          variant={sinActividadReal ? "default" : utilidadReal >= utilidadPresup ? "success" : "destructive"}
        />
        <KpiCard
          label="Margen real"
          // UIA-10: sin venta real el margen no es 0%, es indeterminado.
          value={ventaReal > 0 ? pctPnl(margenReal) : "n/a"}
          delta={`Presup. ${pctPnl(margenPresup)}`}

          variant={
            sinActividadReal
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
        alertaSobrecosto={alertaSobrecosto}
        alertaVenta={alertaVenta}
        alertaMargen={alertaMargen}
        dCostoPct={dCosto.pct}
        margenReal={margenReal}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pendiente de cobro a cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-kpi">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pendiente de pago a proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-kpi">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
          </CardContent>
        </Card>
      </div>

      {/* v13.823.367 — Sin actividad real no se pintan comparativas
          Presupuestado vs. Real: con Real = 0 toda fila leería Δ −100%,
          una desviación ficticia. El card de contexto ya lo explica. */}
      {!sinActividadReal && (
        <>
          <PnlComparativaTable
            titulo="Ingresos por concepto (Presupuestado vs. Real)"
            rows={data.por_concepto}
            invertirAlerta={false}
          />
          <PnlComparativaTable
            titulo="Costos por concepto (Presupuestado vs. Real)"
            rows={data.por_concepto_costo}
            invertirAlerta
          />
          <p className="text-body-sm text-muted-foreground">
        {/* v13.552.0: el KPI "Costo real" ya usa la base gravable (sin IVA) y
            descuenta notas de crédito prorrateadas, igual que el desglose. La
            diferencia restante viene de facturas sin conceptos capturados. */}
        El desglose por concepto y el KPI "Costo real" usan importes sin impuestos. Si una factura de
        proveedor no tiene conceptos capturados, su importe aparece como "(factura completa)".
          </p>
        </>
      )}

      <div ref={registerRef("comision")} data-focus="comision">
        <PnlProveedoresTable proveedores={data.por_proveedor} />
      </div>

      <PnlTipoCambioNota
        embarqueId={embarqueId}
        tcUsd={data.tipo_cambio_usd}
        tcEur={data.tipo_cambio_eur}
      />
    </div>
  );
}
