/**
 * Tarjeta móvil del listado de antigüedad de saldos de CxC.
 * v13.823.25: extraída al migrar `CxcAging.tsx` de `DataTable` a
 * `ResponsiveDataTable`, siguiendo el patrón de `CxpAgingMobileCard`.
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency } from "@/lib/formatters";
import type { CxcAgingRow } from "@/features/cxc/services/cxcAging";

function peorCubetaLabel(r: CxcAgingRow): string {
  if (r.mas_90 > 0) return "+90 días";
  if (r.d_61_90 > 0) return "61-90 días";
  if (r.d_31_60 > 0) return "31-60 días";
  if (r.d_1_30 > 0) return "1-30 días";
  return "Vigente";
}

export function CxcAgingMobileCard({ row }: { row: CxcAgingRow }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">{row.cliente_nombre}</div>
        <div className="text-body-sm text-muted-foreground">
          {row.num_facturas} factura{row.num_facturas === 1 ? "" : "s"}
        </div>
        <div className="text-label text-muted-foreground">
          Cubeta más vencida: {peorCubetaLabel(row)}
        </div>
      </div>
      <MoneyCell
        label="Saldo total"
        value={formatCurrency(row.saldo_total, row.moneda)}
        highlight
        className="shrink-0 w-28"
      />
    </div>
  );
}
