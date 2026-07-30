/**
 * Barra de aprobación en lote para /compras/por-aprobar.
 * Extraído para bajar la complejidad ciclomática de la route.
 */
import { pluralizar } from "@/lib/format/pluralizar";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  selectedCount: number;
  totalSelMxn: number;
  totalSelUsd: number;
  isRunning: boolean;
  progreso?: { hecho: number; total: number } | null;
  onOpenConfirm: () => void;
}

export function ComprasPorAprobarBulkBar({
  selectedCount, totalSelMxn, totalSelUsd, isRunning, progreso, onOpenConfirm,
}: Props) {
  const hasSelection = selectedCount > 0;
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-md border px-3 py-2",
        hasSelection ? "bg-accent/5 border-accent/40" : "bg-muted/30",
      )}
    >
      <p className="text-xs text-muted-foreground">
        {hasSelection
          ? `${pluralizar(selectedCount, "factura")} ${selectedCount === 1 ? "seleccionada" : "seleccionadas"} · ${formatCurrency(totalSelMxn, "MXN")} · ${formatCurrency(totalSelUsd, "USD")}`
          : "Selecciona una o más facturas para aprobarlas en lote."}
        {isRunning && progreso && (
          <span className="ml-2 text-accent">
            Procesando {progreso.hecho}/{progreso.total}…
          </span>
        )}
      </p>
      <Button size="sm" disabled={!hasSelection || isRunning} onClick={onOpenConfirm}>
        {isRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
        Aprobar seleccionadas ({selectedCount})
      </Button>
    </div>
  );
}
