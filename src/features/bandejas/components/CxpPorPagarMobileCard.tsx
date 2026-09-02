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
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">
          {toTitleCase(row.proveedor_nombre ?? "") || "—"}
        </div>
        <div className="text-body-sm text-muted-foreground font-mono truncate">
          {row.folio_proveedor ?? "—"}
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
        className="shrink-0 w-28"
      />
    </div>
  );
}
