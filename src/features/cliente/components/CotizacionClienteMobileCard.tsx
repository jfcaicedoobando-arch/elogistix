/**
 * Tarjeta móvil de la tabla de cotizaciones del cliente (detalle de cliente).
 * Extraída al migrar `ClienteDetalleTablasTabs` de `DataTable` a `ResponsiveDataTable`.
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { CotizacionCliente } from "@/features/cliente/components/clienteColumns";

export function CotizacionClienteMobileCard({ c }: { c: CotizacionCliente }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-body truncate">{c.folio}</div>
        <div className="text-label text-muted-foreground truncate mt-0.5">
          {c.origen || "-"} → {c.destino || "-"} · {formatDate(c.created_at)}
        </div>
        <div className="mt-1">
          <StatusBadge domain="cotizacion" status={c.estado} className="text-2xs" />
        </div>
      </div>
      <MoneyCell
        label="Subtotal"
        value={formatCurrency(c.subtotal, c.moneda)}
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
