/**
 * Resumen "Pendiente" / "En proforma" para `ResumenConceptosVenta`.
 * Extraído para mantener el componente padre bajo Power-of-10 (≤200 líneas).
 */
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";

interface TotalCurrency {
  totalUsd: number;
  totalMxn: number;
}

interface Props {
  totales: { pendiente: TotalCurrency; enProforma: TotalCurrency };
  pendientesCount: number;
  enProformaCount: number;
}

export function ResumenConceptosVentaTotales({ totales, pendientesCount, enProformaCount }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-4 border-t bg-muted/30">
      <div className="rounded-md border bg-background p-3">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="h-4 w-4 text-gray-600" />
          <span className="text-sm font-semibold">Pendiente</span>
          <Badge variant="secondary" className="ml-auto">{pendientesCount}</Badge>
        </div>
        <div className="text-sm space-y-0.5">
          {totales.pendiente.totalMxn > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalMxn, "MXN")}</span></div>
          )}
          {totales.pendiente.totalUsd > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.pendiente.totalUsd, "USD")}</span></div>
          )}
          {totales.pendiente.totalMxn === 0 && totales.pendiente.totalUsd === 0 && (
            <span className="text-muted-foreground text-xs">Sin conceptos pendientes</span>
          )}
        </div>
      </div>
      <div className="rounded-md border border-success/30 bg-success/5 p-3">
        <div className="flex items-center gap-2 mb-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-sm font-semibold">En proforma</span>
          <Badge className="ml-auto bg-success/15 text-success border-success/30">{enProformaCount}</Badge>
        </div>
        <div className="text-sm space-y-0.5">
          {totales.enProforma.totalMxn > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">MXN:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalMxn, "MXN")}</span></div>
          )}
          {totales.enProforma.totalUsd > 0 && (
            <div className="flex justify-between"><span className="text-muted-foreground">USD:</span><span className="font-semibold">{formatCurrency(totales.enProforma.totalUsd, "USD")}</span></div>
          )}
          {totales.enProforma.totalMxn === 0 && totales.enProforma.totalUsd === 0 && (
            <span className="text-muted-foreground text-xs">Sin proformas generadas</span>
          )}
        </div>
      </div>
    </div>
  );
}
