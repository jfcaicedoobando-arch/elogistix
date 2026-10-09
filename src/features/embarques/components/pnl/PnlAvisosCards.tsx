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
import type { PnlDocumentacionIngresos } from "@/features/embarques/services/pnlFinanciero";

interface Props {
  sinActividadReal: boolean;
  alertaSobrecosto: boolean;
  alertaVenta: boolean;
  alertaMargen: boolean;
  dCostoPct: number;
  margenReal: number | null;
  costosIncompletos?: boolean;
  ingresosIncompletos?: boolean;
  ingresosNoEvaluados?: boolean;
  ingresos?: PnlDocumentacionIngresos | null;
  notasCreditoSinBase?: number;
  costoSinAsignar?: number;
  facturasSobreasignadas?: number;
  coberturaNoEvaluada?: boolean;
  segurosInconsistentes?: number;
  documentacionNoEvaluada?: boolean;
  conceptosSinDocumentar?: number;
}

function PnlCostosIncompletos({
  costoSinAsignar = 0, facturasSobreasignadas = 0, notasCreditoSinBase = 0,
  coberturaNoEvaluada = false, segurosInconsistentes = 0,
  documentacionNoEvaluada = false, conceptosSinDocumentar = 0,
}: Pick<Props, "costoSinAsignar" | "facturasSobreasignadas" | "notasCreditoSinBase"
  | "coberturaNoEvaluada" | "segurosInconsistentes"
  | "documentacionNoEvaluada" | "conceptosSinDocumentar">) {
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
        {documentacionNoEvaluada && " La documentación de costos operativos no fue evaluada en esta respuesta; la utilidad no está confirmada."}
        {conceptosSinDocumentar > 0 && ` Hay ${conceptosSinDocumentar} concepto(s) de costo operativo sin asignación positiva a una factura de proveedor vigente. Una prima independiente u otra factura no documentan esos conceptos. El importe facturado no tiene que igualar el presupuesto.`}
        {coberturaNoEvaluada && " La cobertura de seguros no fue evaluada en esta respuesta. El costo observado es provisional y la utilidad no está confirmada."}
        {segurosInconsistentes > 0 && ` Hay ${segurosInconsistentes} vínculo(s) de seguro cuya cobertura completa no se pudo acreditar. Se conservan sus relaciones y el costo documental observado, sin agregar otra prima ni una prima residual; la utilidad no está confirmada.`}
      </AlertDescription>
    </Alert>
  );
}

function PnlIngresosIncompletos({ ingresos, ingresosNoEvaluados }: Pick<Props, "ingresos" | "ingresosNoEvaluados">) {
  const { notas_credito_sin_base = 0, notas_credito_sin_valoracion = 0, facturas_sin_valoracion = 0,
    repartos_provisionales = 0, desbordamientos = 0 } = ingresos ?? {};
  return (
    <Alert variant="warning">
      <AlertCircle className="size-4" />
      <AlertTitle>Ingresos incompletos</AlertTitle>
      <AlertDescription>
        La venta observada conserva únicamente el importe conocido y es provisional.
        La utilidad y el margen no son calculables hasta verificar los ingresos.
        {ingresosNoEvaluados && " La documentación de ingresos no fue evaluada en esta respuesta; la utilidad no está confirmada."}
        {notas_credito_sin_base > 0 && ` Hay ${notas_credito_sin_base} nota(s) de crédito de cliente sin base verificable; no se considera cero ni se usa su monto total como base fiscal.`}
        {notas_credito_sin_valoracion > 0 && ` Hay ${notas_credito_sin_valoracion} nota(s) de crédito de cliente sin valoración utilizable; revisa sus monedas y tipos de cambio.`}
        {facturas_sin_valoracion > 0 && ` Hay ${facturas_sin_valoracion} factura(s) de venta sin valoración utilizable.`}
        {repartos_provisionales > 0 && ` Hay ${repartos_provisionales} factura(s) con notas de crédito sin linaje verificable en reparto proporcional provisional. Ese reparto no acredita a qué concepto corresponde el crédito.`}
        {desbordamientos > 0 && " Se detectaron importes fuera del rango de cálculo; un total no representable se muestra como No calculable."}
      </AlertDescription>
    </Alert>
  );
}

export function PnlAvisosCards({
  sinActividadReal, alertaSobrecosto, alertaVenta, alertaMargen, dCostoPct, margenReal,
  costosIncompletos, notasCreditoSinBase, costoSinAsignar, facturasSobreasignadas,
  coberturaNoEvaluada, segurosInconsistentes,
  documentacionNoEvaluada, conceptosSinDocumentar,
  ingresosIncompletos, ingresosNoEvaluados, ingresos,
}: Props) {
  return (
    <>
      {ingresosIncompletos && <PnlIngresosIncompletos ingresos={ingresos} ingresosNoEvaluados={ingresosNoEvaluados} />}
      {costosIncompletos && (
        <PnlCostosIncompletos costoSinAsignar={costoSinAsignar}
          coberturaNoEvaluada={coberturaNoEvaluada} segurosInconsistentes={segurosInconsistentes}
          documentacionNoEvaluada={documentacionNoEvaluada} conceptosSinDocumentar={conceptosSinDocumentar}
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
