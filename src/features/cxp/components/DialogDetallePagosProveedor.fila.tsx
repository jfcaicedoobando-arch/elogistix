/**
 * Fila individual de la tabla de pagos en DialogDetallePagosProveedor.
 * Extraída para mantener el archivo de sections ≤ 200 líneas.
 * v13.190.0 · Ola 2 · Item 3 — muestra el estado de conciliación bancaria.
 */
import { Pencil, Trash2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatFechaDia } from "@/lib/formatters";
import { ConciliacionPagoCell } from "./ConciliacionPagoCell";
import { Hint } from "@/components/shared/Hint";
import { esPagoAnticipo, origenPagoAnticipo, type PagoConOrigenAnticipo } from "../domain/pagoAnticipoOrigen";

import { TableCell, TableRow } from "@/components/ui/table";
export interface PagoRow extends PagoConOrigenAnticipo {
  es_ajuste?: boolean;
  id: string;
  /** Sello de versión para el bloqueo optimista al editar (H5). */
  updated_at?: string | null;
  fecha_pago: string;
  metodo_pago: string;
  notas?: string | null;
  referencia?: string | null;
  monto: number | string;
  moneda: string;
  tipo_cambio_usd?: number | string | null;
  diferencia_cambiaria_mxn?: number | string | null;
  cuenta_bancaria_id?: string | null;
  bbva_movimientos?: Array<{
    id: string;
    fecha: string;
    concepto: string | null;
    referencia: string | null;
    cargo: number | string;
    cuentas_bancarias?: { moneda: string } | null;
    abono: number | string;
    estado_conciliacion: "Pendiente" | "Conciliado" | "Ignorado";
  }> | null;
}

interface Props {
  pago: PagoRow;
  canEdit: boolean;
  onEliminar: (id: string) => void;
  onEditar?: (pago: PagoRow) => void;
}

export function PagoFila({ pago: p, canEdit, onEliminar, onEditar }: Props) {
  const tc = p.tipo_cambio_usd ? Number(p.tipo_cambio_usd).toFixed(4) : "—";
  const dif = p.diferencia_cambiaria_mxn != null
    ? formatCurrency(Number(p.diferencia_cambiaria_mxn), "MXN")
    : "—";
  const mov = (p.bbva_movimientos ?? []).find(m => p.es_ajuste || m.estado_conciliacion === "Conciliado") ?? null;
  const esAnticipo = esPagoAnticipo(p);
  return (
    <TableRow className="hover:bg-muted/30 transition-colors">
      <TableCell className="whitespace-nowrap text-foreground">
        {formatFechaDia(p.fecha_pago)}
      </TableCell>
      <TableCell>
        <div className="flex flex-col">
          <span className="font-medium text-foreground">{p.metodo_pago}</span>
          {p.referencia && (
            <span className="text-label text-muted-foreground">Ref: {p.referencia}</span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right tabular-nums font-medium text-foreground">
        {formatCurrency(Number(p.monto), p.moneda)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-body-sm text-muted-foreground">{tc}</TableCell>
      <TableCell className="text-right tabular-nums text-body-sm text-muted-foreground">{dif}</TableCell>
      <TableCell>
        <ConciliacionPagoCell
          esAjuste={p.es_ajuste === true}
          pagoId={p.id}
          fechaPago={p.fecha_pago}
          monto={Number(p.monto)}
          cuentaBancariaId={p.cuenta_bancaria_id ?? null}
          movimiento={mov}
          origenAnticipo={origenPagoAnticipo(p)}
          disabled={!canEdit}
        />
      </TableCell>
      <TableCell className="text-right">
        {canEdit && onEditar && !esAnticipo && !p.es_ajuste && (
          <Hint label="Editar pago">
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-primary hover:bg-primary/10"
              onClick={() => onEditar(p)}
              aria-label="Editar pago"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </Hint>
        )}
        {canEdit && (
          <Hint label={esAnticipo ? "Revertir aplicación de anticipo: conserva el cargo original" : "Eliminar pago"}>
            <Button
              variant="ghost"
              size="icon"
              className="min-h-11 min-w-11 md:h-7 md:w-7 md:min-h-0 md:min-w-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => onEliminar(p.id)}
              aria-label={esAnticipo ? "Revertir aplicación de anticipo" : "Eliminar pago"}
            >
              {esAnticipo ? <Undo2 className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
          </Hint>
        )}
      </TableCell>
    </TableRow>
  );
}

