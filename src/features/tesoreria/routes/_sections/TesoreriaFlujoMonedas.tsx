/**
 * Detalle por moneda del flujo esperado a 30 días. Sustituye las 6 tarjetas
 * que competían con los KPIs principales.
 */
import { Table, TableBody, TableHeader, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { Card, CardContent } from "@/components/ui/card";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { formatCurrency } from "@/lib/formatters/numbers";
import { cn } from "@/lib/utils";
import type { FlujoMes } from "@/features/tesoreria/domain/resumen.types";

interface Props {
  flujo: FlujoMes;
}

interface Renglon {
  moneda: string;
  cobrar: number;
  pagar: number;
}

export function TesoreriaFlujoMonedas({ flujo }: Props) {
  const renglones: Renglon[] = [
    { moneda: "MXN", cobrar: flujo.por_cobrar_mxn, pagar: flujo.por_pagar_mxn },
    { moneda: "USD", cobrar: flujo.por_cobrar_usd, pagar: flujo.por_pagar_usd },
  ];

  return (
    <Card>
      <CardContent density="compact">
        <SectionHeading as="h3" className="mb-3">
          Flujo esperado 30 días por moneda
        </SectionHeading>
        <Table>
          <TableHeader>
            <DetailTableRow hoverable={false}>
              <DetailTableHead className="whitespace-nowrap">Moneda</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Por cobrar</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Por pagar</DetailTableHead>
            </DetailTableRow>
          </TableHeader>
          <TableBody>
            {renglones.map((r) => {
              const neto = r.cobrar - r.pagar;
              return (
                <DetailTableRow key={r.moneda}>
                  <TableCell className="font-medium">{r.moneda}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-success">
                    {formatCurrency(r.cobrar, r.moneda)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-warning">
                    {formatCurrency(r.pagar, r.moneda)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right font-semibold tabular-nums",
                      neto >= 0 ? "text-success" : "text-destructive",
                    )}
                  >
                    {formatCurrency(neto, r.moneda)}
                  </TableCell>
                </DetailTableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
