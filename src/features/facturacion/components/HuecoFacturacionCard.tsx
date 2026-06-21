import { useState } from "react";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { HuecoFacturacionDetalleDialog } from "./HuecoFacturacionDetalleDialog";

/**
 * Tira compacta "Hueco de Facturación" (~52px).
 * Embarques con ETD > 5 días sin factura emitida. Indicador global.
 */
export function HuecoFacturacionCard() {
  const [open, setOpen] = useState(false);
  const { isLoading, filas, totalEmbarques, totalUsd, totalMxn, exportarCsv } =
    useHuecoFacturacion();

  if (!isLoading && totalEmbarques === 0) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 px-4 py-2.5 flex items-center gap-2 text-sm">
        <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
        <span className="font-medium text-success">Sin hueco de facturación</span>
        <span className="text-xs text-muted-foreground">— todos los embarques con ETD &gt; 5 días están facturados.</span>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-2.5 flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-x-4 sm:gap-y-1.5 text-sm">
        <div className="flex items-center gap-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="font-semibold text-destructive">Hueco de Facturación</span>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 flex-1 min-w-0">
          <span className="text-muted-foreground">
            <span className="font-semibold text-destructive tabular-nums">
              {isLoading ? "…" : totalEmbarques}
            </span>{" "}
            embarque{totalEmbarques === 1 ? "" : "s"}
          </span>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="font-medium text-destructive tabular-nums">{formatCurrency(totalUsd, "USD")}</span>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="font-medium text-destructive tabular-nums">{formatCurrency(totalMxn, "MXN")}</span>
        </div>

        <Button
          variant="destructive"
          size="sm"
          className="h-9 sm:h-7 w-full sm:w-auto"
          onClick={() => setOpen(true)}
          disabled={totalEmbarques === 0}
        >
          Ver detalle
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <HuecoFacturacionDetalleDialog
        open={open}
        onOpenChange={setOpen}
        filas={filas}
        totalEmbarques={totalEmbarques}
        totalUsd={totalUsd}
        totalMxn={totalMxn}
        isLoading={isLoading}
        onExportCsv={exportarCsv}
      />
    </>
  );
}
