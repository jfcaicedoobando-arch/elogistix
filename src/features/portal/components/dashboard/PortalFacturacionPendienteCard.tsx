import { Receipt, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DrilldownRow } from "@/components/shared/dataTable/DrilldownRow";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  monto: number;
  total: number;
  vencidas: number;
  className?: string;
}

export function PortalFacturacionPendienteCard({ monto, total, vencidas, className }: Props) {
  const drilldownHref = total > 0 ? "/portal/facturas" : null;
  return (
    <DrilldownRow
      href={drilldownHref}
      ariaLabel={drilldownHref ? "Ver facturas pendientes" : undefined}
      className={className}
    >
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Receipt className="h-4 w-4 text-warning" />
            Facturación Pendiente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {total === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              Sin facturas pendientes. 🎉
            </p>
          ) : (
            <>
              <p className="text-3xl font-bold">{formatCurrency(monto, "MXN")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {total} factura{total !== 1 ? "s" : ""} por pagar
              </p>
              <div className="mt-4 space-y-2">
                {vencidas > 0 && (
                  <div className="flex items-center gap-2 text-xs p-2 rounded bg-destructive/10 text-destructive">
                    <span className="font-medium">⚠️ {vencidas} vencida(s)</span>
                  </div>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4 text-xs pointer-events-none"
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
