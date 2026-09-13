/**
 * Tarjeta móvil de la tabla de facturas de proveedor. Extraída de `Cxp.tsx`
 * en v13.823.312 (Power-of-10: ≤200 líneas). Sin cambios visuales.
 */
import { EstadoFacturaCxPCell } from "@/features/cxp/components/EstadoFacturaCxPCell";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatDate, toTitleCase, formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

export function CxpMobileCard({ factura }: { factura: FacturaCxP }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate font-mono">{factura.folio_interno}</div>
        <div className="text-body-sm text-muted-foreground truncate">
          {toTitleCase(factura.proveedor_nombre)}
        </div>
        <div className="text-label text-muted-foreground">
          Vence {factura.fecha_vencimiento ? formatDate(factura.fecha_vencimiento) : "—"}
        </div>
        <EstadoFacturaCxPCell factura={factura} />
      </div>
      <MoneyCell
        label="Saldo"
        value={formatCurrency(factura.saldo, factura.moneda)}
        highlight
        className="shrink-0 w-28"
      />
    </div>
  );
}
