/**
 * Tarjeta móvil del drill-down de facturas con saldo (CxC).
 * Extraída al migrar `CxcAgingDrillDownDialog` a `ResponsiveDataTable`.
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { bucketDeDias, CUBETA_LABELS, CUBETA_TONE } from "@/lib/aging/buckets";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";

export function CxcAgingDrillDownMobileCard({ row: f }: { row: FacturaCobranza }) {
  const bucket = bucketDeDias(f.dias_vencido);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-mono font-semibold text-body truncate">{f.numero}</div>
        {f.expediente && (
          <div className="text-body-sm text-muted-foreground truncate">{f.expediente}</div>
        )}
        <div className="text-label text-muted-foreground">
          Emisión {formatDate(f.fecha_emision)} · Vence {formatDate(f.fecha_vencimiento)}
        </div>
        <ToneBadge tone={CUBETA_TONE[bucket]}>{CUBETA_LABELS[bucket]}</ToneBadge>
      </div>
      <MoneyCell
        label="Saldo"
        value={formatCurrency(f.saldo, f.moneda)}
        highlight
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
