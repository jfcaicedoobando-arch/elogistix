/**
 * Tarjeta móvil del listado de cotizaciones.
 * Extraída de `Cotizaciones.tsx` para respetar el límite de 200 líneas (Power of 10).
 */
import { StatusBadge } from "@/components/shared/StatusBadge";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency } from "@/lib/formatters";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import type { SubtotalMoneda } from "@/features/cotizacion/domain/subtotalesPorMoneda";
import { formatFechaEs } from "@/lib/formatters";

interface Props {
  folio: string;
  clienteNombre: string | null;
  createdAt: string | null;
  estado: string;
  /** Un renglón por moneda: las cotizaciones mixtas tienen USD y MXN. */
  subtotales: SubtotalMoneda[];
  esProspecto?: boolean;
  canDuplicar?: boolean;
  canEliminar?: boolean;
  onDuplicar?: () => void;
  onEliminar?: () => void;
}

export function CotizacionMobileCard({
  folio, clienteNombre, createdAt, estado, subtotales, esProspecto = false,
  canDuplicar = false, canEliminar = false, onDuplicar, onEliminar,
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
        <div className="flex shrink-0 items-start gap-1" data-no-row-nav>
          <StatusBadge domain="cotizacion" status={estado} />
          {(canDuplicar || canEliminar) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="min-h-11 min-w-11" aria-label={`Acciones para ${folio}`}>
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
                {canDuplicar && onDuplicar && (
                  <DropdownMenuItem onClick={onDuplicar}>
                    <Copy className="mr-2 size-4" />Duplicar
                  </DropdownMenuItem>
                )}
                {canDuplicar && canEliminar && <DropdownMenuSeparator />}
                {canEliminar && onEliminar && (
                  <DropdownMenuItem onClick={onEliminar} className="text-destructive focus:text-destructive">
                    <Trash2 className="mr-2 size-4" />Eliminar
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {subtotales.map((s, i) => (
        <MoneyCell
          key={s.moneda}
          label={i === 0 ? "Subtotal" : ""}
          value={formatCurrency(s.monto, s.moneda)}
        />
      ))}
    </div>
  );
}
