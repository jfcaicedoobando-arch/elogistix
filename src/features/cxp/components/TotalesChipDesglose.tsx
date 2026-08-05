/**
 * Chip de total con desglose en popover para el header del modal de captura.
 *
 * v13.422.0 — Sustituye la banda fija de 4 KPIs: recupera alto útil y elimina
 * la celda ambigua que mostraba "IEPS" o "Retenciones" en el mismo lugar.
 */
import { ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  total: number;
  moneda: string;
}

function Renglon({ label, value, fuerte = false }: {
  label: string; value: string; fuerte?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-xs">
      <span className={fuerte ? "font-medium text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
      <span className={`tabular-nums ${fuerte ? "font-semibold" : ""}`}>{value}</span>
    </div>
  );
}

export function TotalesChipDesglose({
  subtotal, iva, ieps, retenciones, total, moneda,
}: Props) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded-lg border bg-card px-3 py-1.5 text-right transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-1 text-2xs font-bold uppercase tracking-tight text-muted-foreground">
            Total {moneda}
            <ChevronDown className="h-3 w-3" aria-hidden />
          </span>
          <span className="block text-base font-semibold tabular-nums leading-tight">
            {formatCurrency(total, moneda)}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 space-y-1.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Desglose
        </p>
        <Renglon label="Subtotal" value={formatCurrency(subtotal, moneda)} />
        <Renglon label="IVA" value={formatCurrency(iva, moneda)} />
        {ieps > 0 && <Renglon label="IEPS" value={formatCurrency(ieps, moneda)} />}
        {retenciones > 0 && (
          <Renglon label="Retenciones" value={`− ${formatCurrency(retenciones, moneda)}`} />
        )}
        <div className="border-t pt-1.5">
          <Renglon label={`Total ${moneda}`} value={formatCurrency(total, moneda)} fuerte />
        </div>
      </PopoverContent>
    </Popover>
  );
}
