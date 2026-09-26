/**
 * Tarjeta móvil de la tabla de facturas de proveedor. Extraída de `Cxp.tsx`
 * en v13.823.312 (Power-of-10: ≤200 líneas).
 * Distingue los folios y conserva el saldo completo en pantallas estrechas.
 */
import { EstadoFacturaCxPCell } from "@/features/cxp/components/EstadoFacturaCxPCell";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatDate, toTitleCase, formatCurrency } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

export function CxpMobileCard({ factura }: { factura: FacturaCxP }) {
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_max-content]">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-body-sm">
          <span className="text-muted-foreground">Folio interno: </span>
          <span className="font-semibold font-mono break-all">{factura.folio_interno}</span>
        </div>
        {factura.folio_proveedor && (
          <div className="text-body-sm">
            <span className="text-muted-foreground">Folio proveedor: </span>
            <span className="font-mono break-all">{factura.folio_proveedor}</span>
          </div>
        )}
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
        className="sm:shrink-0"
        valueClassName="overflow-visible text-clip whitespace-normal break-words"
      />
    </div>
  );
}
