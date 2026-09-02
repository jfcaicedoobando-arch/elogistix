/**
 * Tarjeta móvil de Cobranza (/cobranza).
 * v13.823.25: extraída al migrar `Cartera.tsx` de `DataTable` +
 * `CarteraMobileList` propia a `ResponsiveDataTable` (patrón compartido con
 * CxP/CxC), evitando el desbordamiento horizontal en plegables (~692px).
 */
import { Badge } from "@/components/ui/badge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { badgeVencimientoCartera } from "@/features/bandejas/routes/_sections/carteraDias";
import type { CarteraRow } from "@/features/bandejas/routes/_sections/carteraColumns.types";

export function CarteraMobileCard({ row }: { row: CarteraRow }) {
  const badge = badgeVencimientoCartera(row.fecha_vencimiento, row.dias_vencido);
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-body truncate">{row.numero ?? "—"}</span>
          <Badge variant={badge.variant}>{badge.texto}</Badge>
        </div>
        <div className="text-body-sm text-muted-foreground truncate">
          {row.cliente_nombre ?? "—"}
        </div>
        {row.expediente && (
          <div className="text-label text-muted-foreground font-mono truncate">
            Exp: {row.expediente}
          </div>
        )}
        <div className="text-label text-muted-foreground">
          Vence: {row.fecha_vencimiento ? formatDate(row.fecha_vencimiento) : "—"}
        </div>
      </div>
      <MoneyCell
        label="Saldo"
        value={formatCurrency(Number(row.saldo), row.moneda)}
        highlight
        className="shrink-0 max-w-[48%]"
      />
    </div>
  );
}
