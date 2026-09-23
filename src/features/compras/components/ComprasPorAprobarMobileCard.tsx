/**
 * Tarjeta móvil de la bandeja /compras/por-aprobar.
 * v13.823.25: extraída para migrar la tabla de escritorio a
 * `ResponsiveDataTable`.
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";
import { Info } from "lucide-react";

interface Props {
  row: FacturaCxP;
  seleccionable?: boolean;
  selected?: boolean;
  bloqueada?: boolean;
  motivoBloqueo?: string;
  onSelectedChange?: (checked: boolean) => void;
}

export function ComprasPorAprobarMobileCard({
  row, seleccionable = false, selected = false, bloqueada = false,
  motivoBloqueo = "No puedes aprobar esta factura.", onSelectedChange,
}: Props) {
  const folio = row.folio_proveedor || row.folio_interno || "—";
  return (
    <div className="flex items-start justify-between gap-2">
      {seleccionable && (
        <div className="flex items-center gap-1 pt-1" data-no-row-nav onClick={(e) => e.stopPropagation()}>
          <Checkbox
            aria-label={`Seleccionar factura ${folio}`}
            checked={selected}
            disabled={bloqueada}
            onCheckedChange={(v) => onSelectedChange?.(v === true)}
          />
          {bloqueada && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-label={`Por qué no se puede aprobar: ${motivoBloqueo}`}
                  className="rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Info className="size-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">{motivoBloqueo}</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">
          {toTitleCase(row.proveedor_nombre ?? "") || "—"}
        </div>
        <div className="text-body-sm text-muted-foreground font-mono truncate">
          {folio}
        </div>
        <div className="text-label text-muted-foreground">
          Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
        </div>
      </div>
      <MoneyCell
        label="Total"
        value={formatCurrency(row.total, row.moneda)}
        highlight
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
