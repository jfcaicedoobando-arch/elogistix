/**
 * Tarjeta móvil de la bandeja /compras/por-pagar.
 * v13.823.25: extraída para migrar la tabla de escritorio a
 * `ResponsiveDataTable` sin duplicar la selección en lote (sólo desktop).
 */
import { MoneyCell } from "@/components/shared/MoneyCell";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import type { ChipTone } from "@/lib/ui/badgeTone";
import type { CxpRow } from "@/features/bandejas/routes/_sections/cxpPorPagarColumns";

function toneDiasParaVencer(dias: number): ChipTone {
  if (dias < 0) return "destructive";
  if (dias <= 7) return "warning";
  return "neutral";
}

export function CxpPorPagarMobileCard({ row }: { row: CxpRow }) {
  const dias = row.dias_para_vencer ?? 0;
  return (
    <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-[minmax(0,1fr)_max-content]">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">
          {toTitleCase(row.proveedor_nombre ?? "") || "—"}
        </div>
        <div className="text-body-sm text-muted-foreground">
          Folio proveedor: <span className="font-mono break-all">{row.folio_proveedor ?? "—"}</span>
        </div>
        <div className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span>{row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}</span>
          <ToneBadge tone={toneDiasParaVencer(dias)} size="sm">
            {dias < 0 ? `${Math.abs(dias)} venc.` : `${dias}d`}
          </ToneBadge>
        </div>
      </div>
      <MoneyCell
        label="Saldo"
        value={formatCurrency(row.saldo, row.moneda)}
        highlight
        className="sm:shrink-0"
        valueClassName="overflow-visible text-clip whitespace-normal break-words"
      />
    </div>
  );
}
