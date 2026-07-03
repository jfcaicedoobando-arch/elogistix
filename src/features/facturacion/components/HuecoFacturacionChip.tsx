import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHuecoFacturacion } from "@/features/facturacion/hooks";
import { formatCurrency } from "@/lib/formatters";
import { HuecoFacturacionDetalleDialog } from "./HuecoFacturacionDetalleDialog";

/**
 * Chip inline compacto "Hueco de Facturación" — se coloca junto a la barra
 * de tabs en /facturacion. Reemplaza a HuecoFacturacionCard (la tira roja
 * de ancho completo). Si no hay hueco, no renderiza nada (silencio = ok).
 */
export function HuecoFacturacionChip() {
  const [open, setOpen] = useState(false);
  const { isLoading, filas, totalEmbarques, totalUsd, totalMxn, exportarCsv } =
    useHuecoFacturacion();

  if (isLoading || totalEmbarques === 0) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8 gap-2 border border-destructive/40 bg-destructive/5 text-destructive hover:bg-destructive/10 hover:text-destructive"
        aria-label="Ver hueco de facturación"
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        <span className="text-xs font-semibold">
          Hueco: <span className="tabular-nums">{totalEmbarques}</span>
        </span>
        <span className="hidden md:inline text-xs text-destructive/80 tabular-nums">
          · {formatCurrency(totalUsd, "USD")} · {formatCurrency(totalMxn, "MXN")}
        </span>
      </Button>

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
