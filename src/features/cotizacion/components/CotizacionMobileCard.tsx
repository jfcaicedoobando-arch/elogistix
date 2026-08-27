/**
 * Tarjeta móvil del listado de cotizaciones.
 * Extraída de `Cotizaciones.tsx` para respetar el límite de 200 líneas (Power of 10).
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/formatters";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  folio: string;
  clienteNombre: string | null;
  createdAt: string | null;
  estado: string;
  subtotal: number | null;
  moneda: string | null;
  esProspecto?: boolean;
}

export function CotizacionMobileCard({
  folio, clienteNombre, createdAt, estado, subtotal, moneda, esProspecto = false,
}: Props) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-body truncate">{folio}</div>
            {esProspecto && <Badge variant="info" size="sm" className="shrink-0">Prospecto</Badge>}
          </div>
          <div className="text-body-sm text-muted-foreground truncate mt-0.5">
            {clienteNombre ?? ""}
          </div>
          <div className="text-label text-muted-foreground mt-0.5">
            {/* VF-04: fecha en TZ de negocio (America/Mexico_City). */}
            {createdAt ? formatFechaEs(createdAt) : ""}
          </div>
        </div>
        <StatusBadge domain="cotizacion" status={estado} />
      </div>
      {typeof subtotal === "number" && (
        <MoneyCell label="Subtotal" value={formatCurrency(subtotal, moneda ?? "USD")} />
      )}
    </div>
  );
}
