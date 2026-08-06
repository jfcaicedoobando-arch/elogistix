/**
 * Barra de acciones en lote para /compras/por-aprobar.
 * Extraído para bajar la complejidad ciclomática de la route.
 *
 * v13.428.0 — se agrega "Validar en SAT" antes de aprobar.
 */
import { pluralizar } from "@/lib/format/pluralizar";
import { CheckCircle2, Loader2, ShieldCheck } from "lucide-react";
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
  /** Facturas nacionales con UUID dentro de la selección (validables en SAT). */
  validablesCount: number;
  satRunning: boolean;
  satProgreso?: { hecho: number; total: number } | null;
  onValidarSat: () => void;
}

export function ComprasPorAprobarBulkBar({
  selectedCount, totalSelMxn, totalSelUsd, isRunning, progreso, onOpenConfirm,
  validablesCount, satRunning, satProgreso, onValidarSat,
}: Props) {
  const hasSelection = selectedCount > 0;
  const ocupado = isRunning || satRunning;
  const activo = satRunning ? satProgreso : progreso;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border px-3 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
        hasSelection ? "bg-accent/5 border-accent/40" : "bg-muted/30",
      )}
    >
      <p className="text-xs text-muted-foreground">
        {hasSelection
          ? `${pluralizar(selectedCount, "factura")} ${selectedCount === 1 ? "seleccionada" : "seleccionadas"} · ${formatCurrency(totalSelMxn, "MXN")} · ${formatCurrency(totalSelUsd, "USD")}`
          : "Selecciona una o más facturas para validarlas en el SAT y aprobarlas en lote."}
        {hasSelection && validablesCount > 0 && (
          <span className="ml-2">
            {validablesCount} validable(s) en SAT
          </span>
        )}
        {ocupado && activo && (
          <span className="ml-2 text-accent">
            Procesando {activo.hecho}/{activo.total}…
          </span>
        )}
      </p>
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={validablesCount === 0 || ocupado}
          onClick={onValidarSat}
          title={
            validablesCount === 0
              ? "Solo las facturas nacionales con UUID fiscal se pueden validar en el SAT"
              : "Consulta el estatus del CFDI en el SAT para la selección"
          }
        >
          {satRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1" />}
          Validar en SAT ({validablesCount})
        </Button>
        <Button size="sm" disabled={!hasSelection || ocupado} onClick={onOpenConfirm}>
          {isRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
          Aprobar seleccionadas ({selectedCount})
        </Button>
      </div>
    </div>
  );
}
