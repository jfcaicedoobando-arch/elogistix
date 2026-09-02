/**
 * Tarjeta móvil del libro maestro de pagos (/tesoreria/pagos).
 * v13.823.25: extraída para migrar la tabla de escritorio a
 * `ResponsiveDataTable`.
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { TIPO_PAGO_LABELS, esEntrada, type PagoLibro } from "@/features/tesoreria/domain/libroPagos";

export function LibroPagosMobileCard({ row }: { row: PagoLibro }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <StatusBadge domain="pago_tipo" status={row.tipo} />
          <span className="text-label text-muted-foreground">
            {TIPO_PAGO_LABELS[row.tipo]}
          </span>
        </div>
        <div className="font-semibold text-body truncate">{row.contraparte ?? "—"}</div>
        <div className="text-body-sm text-muted-foreground truncate">
          {row.documento_folio ?? (row.tipo === "anticipo" ? "Sin factura" : "—")}
        </div>
        <div className="text-label text-muted-foreground">
          {formatDate(row.fecha)}
        </div>
      </div>
      <MoneyCell
        label="Monto"
        value={formatCurrency(row.monto, row.moneda)}
        highlight
        className={`shrink-0 w-28 ${esEntrada(row) ? "text-success" : "text-destructive"}`}
      />
    </div>
  );
}
