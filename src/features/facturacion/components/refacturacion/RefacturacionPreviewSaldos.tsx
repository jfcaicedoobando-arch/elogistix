/**
 * Tabla comparativa "antes → después" de los saldos que deja la etapa.
 */
import { ArrowRight } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { SaldoSimulado } from "@/features/facturacion/services/refacturacionSimulacion";

export function RefacturacionPreviewSaldos({ saldos }: { saldos: SaldoSimulado[] }) {
  if (saldos.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-2 text-left font-medium">Documento</th>
            <th className="p-2 text-right font-medium">Saldo antes</th>
            <th className="p-2 text-right font-medium">Saldo después</th>
          </tr>
        </thead>
        <tbody>
          {saldos.map((s, i) => (
            <tr key={s.concepto} className={i % 2 === 0 ? "border-t bg-muted/20" : "border-t"}>
              <td className="p-2">
                <span className="font-medium">{s.concepto}</span>
                {s.nota && <p className="text-muted-foreground">{s.nota}</p>}
              </td>
              <td className="p-2 text-right tabular-nums">
                {formatCurrency(Number(s.antes ?? 0), s.moneda)}
              </td>
              <td className="p-2 text-right tabular-nums font-medium">
                <span className="inline-flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  {formatCurrency(Number(s.despues ?? 0), s.moneda)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
