/**
 * Fila individual de la tabla de pagos en DialogDetallePagosProveedor.
 * Extraída para mantener el archivo de sections ≤ 200 líneas.
 */
import { format } from "date-fns";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/formatters";

export interface PagoRow {
  id: string;
  fecha_pago: string;
  metodo_pago: string;
  referencia?: string | null;
  monto: number | string;
  moneda: string;
  tipo_cambio_usd?: number | string | null;
  diferencia_cambiaria_mxn?: number | string | null;
}

interface Props {
  pago: PagoRow;
  canEdit: boolean;
  onEliminar: (id: string) => void;
}

export function PagoFila({ pago: p, canEdit, onEliminar }: Props) {
  const tc = p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(4) : "—";
  const dif = p.diferencia_cambiaria_mxn != null
    ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN")
    : "—";
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3 whitespace-nowrap text-foreground">
        {format(new Date(p.fecha_pago + "T00:00:00"), "dd/MM/yyyy")}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{p.metodo_pago}</span>
          {p.referencia && (
            <span className="text-[11px] text-muted-foreground">Ref: {p.referencia}</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right tabular-nums font-medium text-foreground">
        {formatCurrency(Number(p.monto), p.moneda)}
      </td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{tc}</td>
      <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{dif}</td>
      <td className="px-2 py-3 text-right">
        {canEdit && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={() => onEliminar(p.id)}
            title="Eliminar pago"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </td>
    </tr>
  );
}
