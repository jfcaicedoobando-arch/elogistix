/**
 * Tab P&L del detalle de embarque. Orquesta sub-componentes KPI/comparativa/proveedores.
 *
 * v13.56.2 — auditoría (paso 5): descompuesto de 289 → ~115 líneas.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { KpiGridSkeleton } from "@/components/shared/skeletons";
import { ChartSkeleton } from "@/components/shared/ChartSkeleton";
import { AlertCircle } from "lucide-react";
import { fmtPnl, pctPnl, deltaPnl } from "@/lib/formatters/pnl";
import { calcularAlertasPnl, PNL_UMBRAL_MARGEN_MIN_PCT } from "@/features/embarques/domain/pnlAlertas";
import { usePnlFinanciero } from "@/features/embarques/hooks/usePnlFinanciero";
import { useFocusSection } from "@/features/embarques/hooks/useFocusSection";
import { KpiCard } from "@/components/shared/KpiCard";
import { PnlComparativaTable } from "./pnl/PnlComparativaTable";
import { PnlProveedoresTable } from "./pnl/PnlProveedoresTable";

interface Props {
  embarqueId: string;
}

// eslint-disable-next-line complexity
export function TabPnl({ embarqueId }: Props) {
  const { data, isLoading, error } = usePnlFinanciero(embarqueId);
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
      <Card>
        <CardContent className="pt-6 text-sm text-destructive">
          No se pudo cargar el P&L del embarque. {(error as Error | null)?.message ?? ""}
        </CardContent>
      </Card>
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
  const { utilidadReal, margenReal, alertaSobrecosto, alertaVenta, alertaMargen } =
    calcularAlertasPnl({ ventaReal, costoReal, ventaPresup, costoPresup, deltaCostoPct: dCosto.pct });
  const dUtilidad = deltaPnl(utilidadReal, utilidadPresup);

  return (
    <div className="space-y-6">
      <div
        ref={registerRef("utilidad")}
        data-focus="utilidad"
        className="grid grid-cols-2 md:grid-cols-4 gap-4"
      >
        <KpiCard
          label="Venta real"
          value={fmtPnl(ventaReal)}
          delta={`Presup. ${fmtPnl(ventaPresup)} · Δ ${fmtPnl(dVenta.abs)}`}
          variant={ventaReal >= ventaPresup ? "success" : "warning"}
        />
        <KpiCard
          label="Costo real"
          value={fmtPnl(costoReal)}
          delta={`Presup. ${fmtPnl(costoPresup)} · Δ ${fmtPnl(dCosto.abs)}`}
          variant={alertaSobrecosto ? "destructive" : "default"}
        />
        <KpiCard
          label="Utilidad real"
          value={fmtPnl(utilidadReal)}
          delta={`Presup. ${fmtPnl(utilidadPresup)} · Δ ${fmtPnl(dUtilidad.abs)}`}
          variant={utilidadReal >= utilidadPresup ? "success" : "destructive"}
        />
        <KpiCard
          label="Margen real"
          value={pctPnl(margenReal)}
          delta={`Presup. ${pctPnl(margenPresup)}`}
          variant={
            utilidadReal < 0 || margenReal < 0
              ? "destructive"
              : margenReal < PNL_UMBRAL_MARGEN_MIN_PCT
                ? "warning"
                : "success"
          }
        />
      </div>

      {(alertaSobrecosto || alertaVenta || alertaMargen) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <CardTitle >Alertas financieras</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alertaSobrecosto && <Badge variant="destructive">Sobrecosto {pctPnl(dCosto.pct)}</Badge>}
            {alertaVenta && (
              <Badge variant="outline" className="border-warning text-warning">
                Venta facturada menor a presupuestada
              </Badge>
            )}
            {alertaMargen && (
              <Badge variant="outline" className="border-warning text-warning">
                Margen real {pctPnl(margenReal)} &lt; 15%
              </Badge>
            )}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle >Pendiente de cobro a cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmtPnl(data.venta.pdte_cobro_mxn)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle >Pendiente de pago a proveedores</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{fmtPnl(data.costo.pdte_pago_mxn)}</div>
          </CardContent>
        </Card>
      </div>

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

      <div ref={registerRef("comision")} data-focus="comision">
        <PnlProveedoresTable proveedores={data.por_proveedor} />
      </div>

      <p className="text-xs text-muted-foreground">
        Tipos de cambio del embarque: USD {data.tipo_cambio_usd?.toFixed(4) ?? "—"} · EUR {data.tipo_cambio_eur?.toFixed(4) ?? "—"}
      </p>
    </div>
  );
}
