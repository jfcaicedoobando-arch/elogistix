/**
 * FacturaPagosTabla — tabla presentacional del historial de pagos.
 * Extraída de `FacturaPagosSection` para respetar el límite de 200 líneas.
 */
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  folio_rep?: string | null;
  uuid_rep?: string | null;
  rep_cancelado_en?: string | null;
}

interface Props {
  pagos: PagoRow[];
  facturaId: string;
  moneda: string;
  canEdit: boolean;
  onEliminar: (pagoId: string) => void;
  onPreviewRep: (id: string, label: string) => void;
}

export function FacturaPagosTabla({
  pagos, facturaId, moneda, canEdit, onEliminar, onPreviewRep,
}: Props) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs text-muted-foreground border-b">
          <tr>
            <th className="text-left py-2 px-2">Fecha</th>
            <th className="text-right py-2 px-2">Monto</th>
            <th className="text-right py-2 px-2">Aplicado</th>
            <th className="text-left py-2 px-2">Forma</th>
            <th className="text-left py-2 px-2">Referencia</th>
            <th className="text-left py-2 px-2">REP</th>
            {canEdit && <th className="w-10"></th>}
          </tr>
        </thead>
        <tbody>
          {pagos.map((p) => {
            const repVivo = !!p.uuid_rep && !p.rep_cancelado_en;
            return (
              <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-2 px-2 whitespace-nowrap">{formatDate(p.fecha_pago)}</td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatCurrency(Number(p.monto), p.moneda)}
                </td>
                <td className="py-2 px-2 text-right tabular-nums">
                  {formatCurrency(Number(p.monto_aplicado_factura), moneda)}
                </td>
                <td className="py-2 px-2">{labelDeCatalogo(FORMAS_PAGO_SAT, p.forma_pago)}</td>
                <td className="py-2 px-2 max-w-[200px] truncate" title={p.referencia ?? ""}>
                  {p.referencia || "—"}
                </td>
                <td className="py-2 px-2">
                  <PagoRepCell
                    pagoId={p.id}
                    facturaId={facturaId}
                    estadoRep={p.estado_rep ?? null}
                    serieRep={p.serie_rep ?? null}
                    folioRep={p.folio_rep ?? null}
                    onPreview={onPreviewRep}
                  />
                </td>
                {canEdit && (
                  <td className="py-2 px-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={repVivo}
                      title={
                        repVivo
                          ? "Cancela el REP (complemento de pago) antes de eliminar este pago"
                          : "Eliminar pago"
                      }
                      onClick={(e) => {
                        e.stopPropagation();
                        if (repVivo) return;
                        onEliminar(p.id);
                      }}
                      aria-label="Eliminar pago"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
