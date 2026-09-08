/**
 * Tarjeta móvil del historial de pagos de una factura.
 * Extraída al migrar `FacturaPagosTabla` a `ResponsiveDataTable`.
 * v13.823.240 — Agrega acción "Cancelar REP" para pagos con complemento vigente.
 */
import { Trash2, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/shared/Hint";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { FORMAS_PAGO_SAT, labelDeCatalogo } from "@/constants/catalogosSAT";
import { PagoRepCell } from "./PagoRepCell";

interface PagoRow {
  id: string;
  fecha_pago: string;
  monto: number | string;
  monto_aplicado_factura: number | string;
  moneda: string;
  forma_pago: string;
  referencia?: string | null;
  estado_rep?: string | null;
  serie_rep?: string | null;
  folio_rep?: number | string | null;
  uuid_rep?: string | null;
  rep_cancelado_en?: string | null;
  rep_cancellation_status?: string | null;
}

interface Props {
  row: PagoRow;
  facturaId: string;
  canEdit: boolean;
  onEliminar: (pagoId: string) => void;
  onCancelarRep: (pago: PagoRow) => void;
  onPreviewRep: (id: string, label: string) => void;
}

export function FacturaPagosMobileCard({ row, facturaId, canEdit, onEliminar, onCancelarRep, onPreviewRep }: Props) {
  const cs = (row.rep_cancellation_status ?? "").toLowerCase();
  const repVivo = !!row.uuid_rep && !row.rep_cancelado_en && cs !== "accepted";
  const repEnVerificacion = repVivo && ["pending", "verifying"].includes(cs);
  const repCancelable = repVivo && !repEnVerificacion;
  return (
    <div className="space-y-1.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="font-semibold text-body">{formatDate(row.fecha_pago)}</div>
          <div className="text-body-sm text-muted-foreground">
            {labelDeCatalogo(FORMAS_PAGO_SAT, row.forma_pago)}
          </div>
          {row.referencia && (
            <div className="text-label text-muted-foreground truncate">{row.referencia}</div>
          )}
        </div>
        <MoneyCell
          label="Monto"
          value={formatCurrency(Number(row.monto), row.moneda)}
          highlight
          className="shrink-0 max-w-[48%]"
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <PagoRepCell
          pagoId={row.id}
          facturaId={facturaId}
          estadoRep={row.estado_rep ?? null}
          serieRep={row.serie_rep ?? null}
          folioRep={row.folio_rep ?? null}
          onPreview={onPreviewRep}
        />
        {canEdit && (
          <Hint
            label={
              repVivo
                ? "Cancela el REP (complemento de pago) antes de eliminar este pago"
                : "Eliminar pago"
            }
          >
            <Button
              variant="ghost"
              size="icon"
              disabled={repVivo}
              onClick={(e) => {
                e.stopPropagation();
                if (repVivo) return;
                onEliminar(row.id);
              }}
              aria-label="Eliminar pago"
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </Hint>
        )}
      </div>
    </div>
  );
}
