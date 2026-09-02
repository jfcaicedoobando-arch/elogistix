import { Receipt } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";

/**
 * Notas de crédito aplicadas a una factura en el portal del cliente.
 * Extraída de `PortalFacturaPagosCard` (límite de complejidad Power of 10).
 */
export interface PortalNotaCreditoFila {
  id: string;
  folio?: string | null;
  fecha_emision: string;
  monto: number | string;
}

interface Props {
  notasCredito: readonly PortalNotaCreditoFila[];
  /** Moneda de la factura. */
  moneda: string;
}

export function PortalFacturaNotasCreditoLista({ notasCredito, moneda }: Props) {
  return (
    <div className="border-t pt-3 space-y-2">
      <p className="text-body-sm font-medium text-muted-foreground flex items-center gap-1.5">
        <Receipt className="h-3.5 w-3.5" /> Notas de crédito aplicadas
      </p>
      <ul className="divide-y">
        {notasCredito.map((nc) => (
          <li key={nc.id} className="py-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body font-medium truncate">NC {nc.folio ?? "—"}</p>
              <p className="text-body-sm text-muted-foreground">
                {formatDate(nc.fecha_emision)}
              </p>
            </div>
            <p className="text-body font-bold tabular-nums text-success shrink-0">
              −{formatCurrency(Number(nc.monto), moneda)}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
