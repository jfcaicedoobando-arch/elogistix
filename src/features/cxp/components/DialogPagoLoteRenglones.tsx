/**
 * Tabla de reparto del pago en lote (v13.445.0).
 * Se extrae del diálogo para respetar el límite de 200 líneas por componente.
 */
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toTitleCase } from "@/lib/formatters";
import type { FacturaLoteCandidata, RenglonLote } from "@/features/cxp/services/pagoProveedorLote";

interface Props {
  facturas: FacturaLoteCandidata[];
  renglones: RenglonLote[];
  moneda: string;
  onMontoChange: (facturaId: string, monto: number) => void;
}

export function DialogPagoLoteRenglones({ facturas, renglones, moneda, onMontoChange }: Props) {
  const montoDe = (id: string) => renglones.find((r) => r.factura_id === id)?.monto ?? 0;

  return (
    <div className="rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Factura</th>
            <th className="px-3 py-2 text-left font-medium">Vence</th>
            <th className="px-3 py-2 text-right font-medium">Saldo</th>
            <th className="px-3 py-2 text-right font-medium">Se aplica</th>
            <th className="px-3 py-2 text-right font-medium">Queda</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f) => {
            const monto = montoDe(f.factura_id);
            const queda = Math.max(0, Math.round((f.saldo - monto) * 100) / 100);
            return (
              <tr key={f.factura_id} className="border-t">
                <td className="px-3 py-2 font-mono text-xs">
                  {toTitleCase(f.folio_proveedor ?? "") || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(f.saldo, moneda)}
                </td>
                <td className="px-3 py-2 text-right">
                  <Input
                    type="text"
                    inputMode="decimal"
                    className="h-8 w-32 text-right tabular-nums"
                    value={monto === 0 ? "" : String(monto)}
                    placeholder="0.00"
                    onChange={(e) => onMontoChange(f.factura_id, Number(e.target.value) || 0)}
                    aria-label={`Importe aplicado a la factura ${f.folio_proveedor ?? ""}`}
                  />
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                  {formatCurrency(queda, moneda)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
