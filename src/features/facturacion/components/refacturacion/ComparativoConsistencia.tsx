/**
 * Panel comparativo original vs. nueva factura: moneda, importes e impuestos.
 * Los hallazgos vienen de la RPC `refacturacion_validar_consistencia`.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatters";
import type { ConsistenciaRefacturacion } from "@/features/facturacion/services/refacturacionConsistencia";

const FILAS: Array<{ campo: string; key: "subtotal" | "iva" | "ret_isr" | "ret_iva" | "total" }> = [
  { campo: "Subtotal", key: "subtotal" },
  { campo: "IVA trasladado", key: "iva" },
  { campo: "Retención de ISR", key: "ret_isr" },
  { campo: "Retención de IVA", key: "ret_iva" },
  { campo: "Total", key: "total" },
];

export function ComparativoConsistencia({ data }: { data: ConsistenciaRefacturacion }) {
  const orig = data.factura_original;
  const nueva = data.factura_nueva;

  return (
    <div className="space-y-3">
      {orig && nueva && (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-left font-medium">Concepto</th>
                <th className="p-2 text-right font-medium">{orig.numero ?? "Original"}</th>
                <th className="p-2 text-right font-medium">{nueva.numero ?? "Nueva"}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="p-2">Moneda</td>
                <td className="p-2 text-right">{orig.moneda}</td>
                <td className="p-2 text-right">{nueva.moneda}</td>
              </tr>
              {FILAS.map((f, i) => (
                <tr key={f.key} className={i % 2 === 0 ? "border-t bg-muted/20" : "border-t"}>
                  <td className="p-2">{f.campo}</td>
                  <td className="p-2 text-right">
                    {formatCurrency(Number(orig[f.key] ?? 0), orig.moneda)}
                  </td>
                  <td className="p-2 text-right">
                    {formatCurrency(Number(nueva[f.key] ?? 0), nueva.moneda)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.ok ? (
        <div className="rounded-md border border-success/30 bg-success/5 p-3 text-sm flex items-start gap-2">
          <CheckCircle2 className="h-4 w-4 text-success mt-0.5" />
          <span>Los importes, impuestos y la moneda coinciden con la factura original.</span>
        </div>
      ) : (
        <ul className="space-y-1">
          {data.hallazgos.map((h) => (
            <li
              key={`${h.codigo}-${h.mensaje}`}
              className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs flex items-start gap-2"
            >
              <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5" />
              <span>{h.mensaje}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
