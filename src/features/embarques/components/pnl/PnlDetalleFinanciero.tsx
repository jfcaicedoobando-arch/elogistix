import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fmtPnl } from "@/lib/formatters/pnl";
import type { PnlEmbarque } from "../../services/pnlFinanciero";
import { PnlComparativaTable } from "./PnlComparativaTable";

interface Props {
  data: PnlEmbarque;
  sinActividadReal: boolean;
}

export function PnlDetalleFinanciero({ data, sinActividadReal }: Props) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Pendiente de cobro a cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-kpi">{data.venta.pdte_cobro_mxn === null ? "No calculable" : fmtPnl(data.venta.pdte_cobro_mxn)}</div>
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
        proveedor no tiene conceptos capturados, la base pendiente de desglosar aparece como "(factura completa / base sin detalle)".
          </p>
        </>
      )}
    </>
  );
}
