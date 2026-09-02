/**
 * Tarjeta móvil de la bandeja /compras/por-aprobar.
 * v13.823.25: extraída para migrar la tabla de escritorio a
 * `ResponsiveDataTable` sin la selección en lote (sólo desktop).
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { FacturaCxP } from "@/features/cxp/services";

export function ComprasPorAprobarMobileCard({ row }: { row: FacturaCxP }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">
          {toTitleCase(row.proveedor_nombre ?? "") || "—"}
        </div>
        <div className="text-body-sm text-muted-foreground font-mono truncate">
          {row.folio_proveedor || row.folio_interno || "—"}
        </div>
        <div className="text-label text-muted-foreground">
          Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
        </div>
      </div>
      <MoneyCell
        label="Total"
        value={formatCurrency(row.total, row.moneda)}
        highlight
        className="shrink-0 w-28"
      />
    </div>
  );
}
