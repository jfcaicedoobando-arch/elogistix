import { Receipt, ArrowRight, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import { formatCurrency } from "@/lib/formatters";
import type { KpiPorMoneda } from "@/features/facturacion/estadoCuenta/services/estadoCuentaAggregates";

interface Props {
  montos: KpiPorMoneda;
  total: number;
  vencidas: number;
  className?: string;
}

export function PortalFacturacionPendienteCard({ montos, total, vencidas, className }: Props) {
  const drilldownHref = total > 0 ? ROUTES.PORTAL_FACTURAS : null;
  return (
    <DrilldownRow
      href={drilldownHref}
      ariaLabel={drilldownHref ? "Ver facturas pendientes" : undefined}
      className={className}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-4 w-4 text-warning" />
            Facturación Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-body-sm text-muted-foreground text-center py-6">
              Sin facturas pendientes.
            </p>
          ) : (
            <>
              {/* B-076: nunca sumar monedas distintas — un total por moneda. */}
              {montos.mxn > 0 && (
                <p className="text-kpi">{formatCurrency(montos.mxn, "MXN")}</p>
              )}
              {montos.usd > 0 && (
                <p className={montos.mxn > 0 ? "text-kpi mt-0.5" : "text-kpi"}>
                  {formatCurrency(montos.usd, "USD")}
                </p>
              )}
              <p className="text-body-sm text-muted-foreground mt-1">
                {total} factura{total !== 1 ? "s" : ""} por pagar
              </p>
              <div className="mt-4 space-y-2">
                {vencidas > 0 && (
                  <div className="flex items-center gap-2 text-body-sm p-2 rounded bg-destructive/10 text-destructive">
                    <span className="font-medium inline-flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {vencidas} vencida(s)</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 text-body-sm pointer-events-none"
                tabIndex={-1}
                aria-hidden
              >
                Ver facturas <ArrowRight className="h-3 w-3 ml-1" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </DrilldownRow>
  );
}
