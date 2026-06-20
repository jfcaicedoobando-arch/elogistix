/**
 * Sub-componentes presentacionales de `ProformaDetalle`.
 * Extraídos para mantener la página ≤200 líneas (Power-of-10 #4).
 */
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/formatters";
import type { calcularTotalesProforma } from "@/features/proformas/domain/proforma";

export function EstadoBadges({ estadoRev, facturada }: { estadoRev: string; facturada: boolean }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {estadoRev === "pendiente" && <Badge variant="warning">Pendiente de revisión</Badge>}
      {estadoRev === "aprobada" && <Badge variant="success">Aprobada</Badge>}
      {estadoRev === "consolidada" && <Badge variant="info">Consolidada</Badge>}
      {facturada
        ? <Badge variant="success">Facturada</Badge>
        : <Badge variant="warning">Pago pendiente</Badge>}
    </div>
  );
}

type Totales = ReturnType<typeof calcularTotalesProforma>;

export function TotalesCard({ totales }: { totales: Totales }) {
  const hasUsd = totales.subtotal_usd > 0;
  const hasMxn = totales.subtotal_mxn > 0;
  if (!hasUsd && !hasMxn) return null;
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Totales</CardTitle></CardHeader>
      <CardContent className="grid grid-cols-2 gap-6 text-sm">
        {hasUsd && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">USD</p>
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal_usd, "USD")}</span></div>
            <div className="flex justify-between"><span>IVA</span><span className="tabular-nums">{formatCurrency(totales.iva_usd, "USD")}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="tabular-nums text-accent">{formatCurrency(totales.total_usd, "USD")}</span></div>
          </div>
        )}
        {hasMxn && (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium">MXN</p>
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(totales.subtotal_mxn, "MXN")}</span></div>
            <div className="flex justify-between"><span>IVA</span><span className="tabular-nums">{formatCurrency(totales.iva_mxn, "MXN")}</span></div>
            <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="tabular-nums text-accent">{formatCurrency(totales.total_mxn, "MXN")}</span></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
