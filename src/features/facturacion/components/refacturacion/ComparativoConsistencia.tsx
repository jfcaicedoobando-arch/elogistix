/**
 * Panel comparativo original vs. nueva factura: moneda, importes e impuestos.
 * Los hallazgos vienen de la RPC `refacturacion_validar_consistencia`.
 */
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Table, TableBody, TableHeader, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
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
          <Table>
            <TableHeader>
              <DetailTableRow hoverable={false}>
                <DetailTableHead>Concepto</DetailTableHead>
                <DetailTableHead className="text-right">
                  {orig.numero ?? "Original"}
                </DetailTableHead>
                <DetailTableHead className="text-right">{nueva.numero ?? "Nueva"}</DetailTableHead>
              </DetailTableRow>
            </TableHeader>
            <TableBody>
              <DetailTableRow>
                <TableCell>Moneda</TableCell>
                <TableCell className="text-right">{orig.moneda}</TableCell>
                <TableCell className="text-right">{nueva.moneda}</TableCell>
              </DetailTableRow>
              {FILAS.map((f) => (
                <DetailTableRow key={f.key}>
                  <TableCell>{f.campo}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(orig[f.key] ?? 0), orig.moneda)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(Number(nueva[f.key] ?? 0), nueva.moneda)}
                  </TableCell>
                </DetailTableRow>
              ))}
            </TableBody>
          </Table>
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
