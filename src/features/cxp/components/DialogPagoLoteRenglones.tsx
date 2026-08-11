/**
 * Tabla de reparto del pago en lote (v13.445.0).
 * Rediseñada v13.498.0 con el formato del cobro en lote (CxC): zebra, badges
 * de estado y campo de dinero alineado a la derecha.
 */
import { MoneyInput } from "@/components/shared/MoneyInput";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, toTitleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
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
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="w-[18%] px-3 py-2 text-left font-medium">Factura</th>
            <th className="w-[16%] px-3 py-2 text-left font-medium">Vence</th>
            <th className="w-[20%] px-3 py-2 text-right font-medium">Saldo</th>
            <th className="w-[22%] px-3 py-2 text-right font-medium">Se aplica</th>
            <th className="w-[24%] px-3 py-2 text-right font-medium">Queda</th>
          </tr>
        </thead>
        <tbody>
          {facturas.map((f, i) => {
            const monto = montoDe(f.factura_id);
            const queda = Math.max(0, Math.round((f.saldo - monto) * 100) / 100);
            const liquidada = monto > 0 && queda <= 0.009;
            const parcial = monto > 0 && !liquidada;
            return (
              <tr key={f.factura_id} className={cn("border-t", i % 2 === 1 && "bg-muted/20")}>
                <td className="px-3 py-2 font-mono text-xs">
                  {toTitleCase(f.folio_proveedor ?? "") || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {f.fecha_vencimiento ? formatDate(f.fecha_vencimiento) : "—"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatCurrency(f.saldo, moneda)}
                </td>
                <td className="px-3 py-2">
                  <MoneyInput
                    className="ml-auto h-9 w-full max-w-[150px] text-right"
                    value={monto === 0 ? null : monto}
                    currency={moneda}
                    aria-label={`Importe aplicado a la factura ${f.folio_proveedor ?? ""}`}
                    onChange={(n: number) => onMontoChange(f.factura_id, n)}
                  />
                </td>
                <td className="px-3 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {liquidada && (
                      <Badge variant="outline" className="text-[10px]">Liquidada</Badge>
                    )}
                    {parcial && (
                      <Badge variant="secondary" className="text-[10px]">Parcial</Badge>
                    )}
                    <span className="tabular-nums text-muted-foreground">
                      {formatCurrency(queda, moneda)}
                    </span>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
