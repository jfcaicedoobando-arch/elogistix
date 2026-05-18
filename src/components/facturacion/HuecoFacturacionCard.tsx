import { useState } from "react";
import { AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHuecoFacturacion } from "@/hooks/facturacion";
import { formatCurrency } from "@/lib/formatters";
import { HuecoFacturacionDetalleDialog } from "./HuecoFacturacionDetalleDialog";

/**
 * Tarjeta fija "Hueco de Facturación":
 * embarques con ETD > 5 días sin factura emitida.
 * Indicador global, NO depende del selector de mes.
 */
export function HuecoFacturacionCard() {
  const [open, setOpen] = useState(false);
  const { isLoading, filas, totalEmbarques, totalUsd, totalMxn, exportarCsv } =
    useHuecoFacturacion();

  // Si está cargando o no hay hueco, mostramos un estado compacto positivo.
  if (!isLoading && totalEmbarques === 0) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-4 flex items-center gap-3">
        <div className="rounded-lg bg-success/15 p-2">
          <AlertTriangle className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-success">Sin hueco de facturación</p>
          <p className="text-xs text-muted-foreground">
            Todos los embarques con ETD &gt; 5 días están facturados.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative rounded-xl border-2 border-destructive/40 bg-destructive/5 overflow-hidden">
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-destructive" />
        <div className="p-5 pl-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="rounded-lg bg-destructive/15 p-2.5 shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>

            <div className="flex-1 min-w-[220px]">
              <h3 className="text-sm font-bold tracking-wide uppercase text-destructive">
                ⚠ Hueco de Facturación
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Embarques con ETD &gt; 5 días (proveedor ya facturó) y sin factura emitida al
                cliente.
                <span className="ml-1 italic">Indicador global, no depende del mes seleccionado.</span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold tabular-nums text-destructive leading-none">
                  {isLoading ? "…" : totalEmbarques}
                </div>
                <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">
                  Embarques
                </div>
              </div>
              <div className="h-10 w-px bg-destructive/20" />
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Sin facturar USD</div>
                <div className="text-lg font-semibold tabular-nums text-destructive">
                  {formatCurrency(totalUsd, "USD")}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-muted-foreground">Sin facturar MXN</div>
                <div className="text-lg font-semibold tabular-nums text-destructive">
                  {formatCurrency(totalMxn, "MXN")}
                </div>
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={() => setOpen(true)}
                disabled={totalEmbarques === 0}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Ver detalle
              </Button>
            </div>
          </div>
        </div>
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
