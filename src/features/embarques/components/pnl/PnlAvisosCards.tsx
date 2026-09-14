/**
 * Tarjetas de contexto/alerta del tab P&L (extraídas en v13.823.368 por
 * Power of 10): "Sin actividad real todavía" en Borrador sin importes
 * reales, y "Alertas financieras" cuando hay desviaciones reales.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { pctPnl } from "@/lib/formatters/pnl";

interface Props {
  sinActividadReal: boolean;
  alertaSobrecosto: boolean;
  alertaVenta: boolean;
  alertaMargen: boolean;
  dCostoPct: number;
  margenReal: number;
}

export function PnlAvisosCards({
  sinActividadReal, alertaSobrecosto, alertaVenta, alertaMargen, dCostoPct, margenReal,
}: Props) {
  return (
    <>
      {sinActividadReal && (
        <Card className="border-border bg-muted/40">
          <CardHeader className="pb-2 flex flex-row items-center gap-2">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Sin actividad real todavía</CardTitle>
          </CardHeader>
          <CardContent className="text-body-sm text-muted-foreground">
            El embarque está en Borrador y aún no tiene facturas de venta ni costos reales.
            Las cifras mostradas son el presupuesto; las desviaciones aparecerán cuando
            empiece la operación.
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
            {alertaMargen && (
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
