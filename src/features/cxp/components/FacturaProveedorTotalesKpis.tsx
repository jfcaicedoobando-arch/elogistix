/**
 * KPIs de totales del formulario de captura de factura de proveedor.
 * v13.400.0 — Banda compacta: vive fija bajo el header del modal, así que se
 * mantiene en un solo renglón (4 columnas) para no comerse el alto útil.
 */
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/formatters";

interface Props {
  subtotal: number;
  iva: number;
  ieps: number;
  retenciones: number;
  total: number;
  moneda: string;
}

function Celda({ label, value, emphasis = false }: {
  label: string; value: string; emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border bg-card px-2.5 py-1.5",
        emphasis && "border-accent/30 ring-1 ring-accent/30",
      )}
    >
      <p className="truncate text-2xs font-bold uppercase tracking-tight text-muted-foreground">
        {label}
      </p>
      <p
        className={cn(
          "truncate text-sm font-semibold tabular-nums sm:text-base",
          emphasis && "text-foreground",
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function FacturaProveedorTotalesKpis({
  subtotal, iva, ieps, retenciones, total, moneda,
}: Props) {
  const conIeps = ieps > 0;
  return (
    <div className="grid grid-cols-4 gap-2">
      <Celda label="Subtotal" value={formatCurrency(subtotal, moneda)} />
      <Celda label="IVA" value={formatCurrency(iva, moneda)} />
      <Celda
        label={conIeps ? "IEPS" : "Retenciones"}
        value={formatCurrency(conIeps ? ieps : retenciones, moneda)}
      />
      <Celda label={`Total ${moneda}`} value={formatCurrency(total, moneda)} emphasis />
    </div>
  );
}
