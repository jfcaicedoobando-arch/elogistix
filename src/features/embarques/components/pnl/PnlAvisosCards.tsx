/**
 * Tarjetas de contexto/alerta del tab P&L (extraídas en v13.823.368 por
 * Power of 10): "Sin actividad real todavía" en Borrador sin importes
 * reales, y "Alertas financieras" cuando hay desviaciones reales.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { fmtPnl, pctPnl } from "@/lib/formatters/pnl";

interface Props {
  sinActividadReal: boolean;
  alertaSobrecosto: boolean;
  alertaVenta: boolean;
  alertaMargen: boolean;
  dCostoPct: number;
  margenReal: number | null;
  costosIncompletos?: boolean;
  notasCreditoSinBase?: number;
  costoSinAsignar?: number;
  facturasSobreasignadas?: number;
}

function PnlCostosIncompletos({
  costoSinAsignar = 0, facturasSobreasignadas = 0, notasCreditoSinBase = 0,
}: Pick<Props, "costoSinAsignar" | "facturasSobreasignadas" | "notasCreditoSinBase">) {
  return (
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Costos incompletos</AlertTitle>
      <AlertDescription>
        La utilidad y el margen no son calculables todavía. Captura las facturas de proveedor
        y sus vínculos al embarque, y revisa los tipos de cambio. El costo registrado no sustituye
        los costos pendientes de capturar.
        {costoSinAsignar > 0 && ` Las facturas vinculadas tienen ${fmtPnl(costoSinAsignar)} de base sin asignar a embarques; completa sus vínculos para determinar la utilidad.`}
        {facturasSobreasignadas > 0 && ` Las asignaciones de ${facturasSobreasignadas} factura(s) exceden su base fiscal. El costo y el saldo por embarque muestran un reparto proporcional provisional; revisa sus vínculos antes de determinar la utilidad.`}
        {notasCreditoSinBase > 0 && ` Hay ${notasCreditoSinBase} nota(s) de crédito sin base fiscal verificable; su reversión de costo está pendiente de validar.`}
      </AlertDescription>
    </Alert>
  );
}

export function PnlAvisosCards({
  sinActividadReal, alertaSobrecosto, alertaVenta, alertaMargen, dCostoPct, margenReal,
  costosIncompletos = false, notasCreditoSinBase = 0, costoSinAsignar = 0, facturasSobreasignadas = 0,
}: Props) {
  return (
    <>
      {costosIncompletos && (
        <PnlCostosIncompletos costoSinAsignar={costoSinAsignar}
          facturasSobreasignadas={facturasSobreasignadas} notasCreditoSinBase={notasCreditoSinBase} />
      )}
      {sinActividadReal && (
        <Card className="border-border bg-muted/40">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Sin actividad real todavía</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-muted-foreground">
            {/* P1-3 — El aviso no debe afirmar que el embarque está en Borrador:
                un Confirmado con facturas en borrador también llega aquí. */}
            Este embarque aún no tiene facturas de venta emitidas ni costos reales
            registrados. Las cifras mostradas son el presupuesto; las desviaciones
            aparecerán cuando haya importes reales.
          </CardContent>
        </Card>
      )}

      {(alertaSobrecosto || alertaVenta || alertaMargen) && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <CardTitle>Alertas financieras</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {alertaSobrecosto && <Badge variant="destructive">Sobrecosto {pctPnl(dCostoPct)}</Badge>}
            {alertaVenta && (
              <Badge variant="outline" className="border-warning text-warning">
                Venta facturada menor a presupuestada
              </Badge>
            )}
            {alertaMargen && margenReal !== null && (
              <Badge variant="outline" className="border-warning text-warning">
                Margen real {pctPnl(margenReal)} &lt; 15%
              </Badge>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
