/**
 * Tabla comparativa "antes → después" de los saldos que deja la etapa.
 */
import { ArrowRight } from "lucide-react";
import { Table, TableBody, TableHeader, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency } from "@/lib/formatters";
import type { SaldoSimulado } from "@/features/facturacion/services/refacturacionSimulacion";

export function RefacturacionPreviewSaldos({ saldos }: { saldos: SaldoSimulado[] }) {
  if (saldos.length === 0) return null;

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <DetailTableRow hoverable={false}>
            <DetailTableHead>Documento</DetailTableHead>
            <DetailTableHead className="text-right">Saldo antes</DetailTableHead>
            <DetailTableHead className="text-right">Saldo después</DetailTableHead>
          </DetailTableRow>
        </TableHeader>
        <TableBody>
          {saldos.map((s) => (
            <DetailTableRow key={s.concepto}>
              <TableCell>
                <span className="font-medium">{s.concepto}</span>
                {s.nota && <p className="text-muted-foreground">{s.nota}</p>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatCurrency(Number(s.antes ?? 0), s.moneda)}
              </TableCell>
              <TableCell className="text-right tabular-nums font-medium">
                <span className="inline-flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
                  {formatCurrency(Number(s.despues ?? 0), s.moneda)}
                </span>
              </TableCell>
            </DetailTableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
