/**
 * Sub-componentes presentacionales extraídos de DialogDetallePagosProveedor
 * para mantener su complejidad ciclomática ≤ 16 y tamaño ≤ 200 líneas.
 */
import { format } from "date-fns";
import { DollarSign, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/formatters";
import { HeaderWithTooltip } from "./DialogDetallePagosProveedor.parts";
import type { FacturaCxP } from "@/features/cxp/services";

interface PagoRow {
  id: string;
  fecha_pago: string;
  metodo_pago: string;
  referencia?: string | null;
  monto: number | string;
  moneda: string;
  tipo_cambio_usd?: number | string | null;
  diferencia_cambiaria_mxn?: number | string | null;
}

interface ToolbarProps {
  factura: FacturaCxP;
  canEdit: boolean;
  aprobada: boolean;
  pagable: boolean;
  puedeEliminar: boolean;
  onPagar?: (f: FacturaCxP) => void;
  onEditar?: (f: FacturaCxP) => void;
  onEliminar?: (f: FacturaCxP) => void;
}

export function FacturaToolbar({
  factura: f, canEdit, aprobada, pagable, puedeEliminar, onPagar, onEditar, onEliminar,
}: ToolbarProps) {
  if (!canEdit || (!onPagar && !onEditar && !onEliminar)) return null;
  return (
    <div className="px-6 py-3 border-b bg-muted/20 flex flex-wrap items-center gap-2">
      {onPagar && pagable && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button size="sm" onClick={() => onPagar(f)} disabled={!aprobada}>
                <DollarSign className="h-3.5 w-3.5 mr-1" /> Registrar pago
              </Button>
            </span>
          </TooltipTrigger>
          {!aprobada && (
            <TooltipContent>Requiere aprobación antes de pagar</TooltipContent>
          )}
        </Tooltip>
      )}
      {onEditar && (
        <Button variant="outline" size="sm" onClick={() => onEditar(f)}>
          <Pencil className="h-3.5 w-3.5 mr-1" /> Editar factura
        </Button>
      )}
      {onEliminar && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEliminar(f)}
                disabled={!puedeEliminar}
                className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar factura
              </Button>
            </span>
          </TooltipTrigger>
          {!puedeEliminar && (
            <TooltipContent>No se puede eliminar: tiene pagos registrados</TooltipContent>
          )}
        </Tooltip>
      )}
    </div>
  );
}

interface PagosTableProps {
  pagos: PagoRow[];
  isLoading: boolean;
  canEdit: boolean;
  onEliminarPago: (id: string) => void;
}

export function PagosTable({ pagos, isLoading, canEdit, onEliminarPago }: PagosTableProps) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }
  if (pagos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-12">
        No hay pagos registrados para esta factura.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="text-left px-4 py-3 font-bold">Fecha</th>
            <th className="text-left px-4 py-3 font-bold">Método</th>
            <th className="text-right px-4 py-3 font-bold">Monto</th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip
                label="TC Pago"
                hint="Tipo de cambio USD→MXN registrado al momento de aplicar el pago."
              />
            </th>
            <th className="text-right px-4 py-3 font-bold">
              <HeaderWithTooltip
                label="Dif. Cambio"
                hint="Diferencia cambiaria en MXN (ganancia o pérdida) entre la tasa de la factura y la tasa del pago."
              />
            </th>
            <th className="w-12" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {pagos.map((p) => (
            <tr key={p.id} className="hover:bg-muted/30 transition-colors">
              <td className="px-4 py-3 whitespace-nowrap text-foreground">
                {format(new Date(p.fecha_pago + "T00:00:00"), "dd/MM/yyyy")}
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{p.metodo_pago}</span>
                  {p.referencia && (
                    <span className="text-[11px] text-muted-foreground">
                      Ref: {p.referencia}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
                {formatCurrency(Number(p.monto), p.moneda)}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                {p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(4) : "—"}
              </td>
              <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">
                {p.diferencia_cambiaria_mxn != null
                  ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN")
                  : "—"}
              </td>
              <td className="px-2 py-3 text-right">
                {canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={() => onEliminarPago(p.id)}
                    title="Eliminar pago"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
