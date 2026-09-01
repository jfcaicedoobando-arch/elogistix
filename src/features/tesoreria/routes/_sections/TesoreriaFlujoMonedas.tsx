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
import { useHorizontalScrollEdges } from "@/components/shared/dataTable/useHorizontalScrollEdges";
import { HorizontalScrollFades } from "@/components/shared/dataTable/HorizontalScrollFades";
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
  const { ref: scrollRef, atStart, atEnd, overflowing } = useHorizontalScrollEdges<HTMLDivElement>();
  const renglones: Renglon[] = [
    { moneda: "MXN", cobrar: flujo.por_cobrar_mxn, pagar: flujo.por_pagar_mxn },
    { moneda: "USD", cobrar: flujo.por_cobrar_usd, pagar: flujo.por_pagar_usd },
    // P1-7: fila EUR (antes ausente, la porción EUR se perdía en el total MXN).
    ...(flujo.por_cobrar_eur !== 0 || flujo.por_pagar_eur !== 0
      ? [{ moneda: "EUR", cobrar: flujo.por_cobrar_eur, pagar: flujo.por_pagar_eur }]
      : []),
  ];

  return (
    <Card>
      <CardContent density="compact">
        <SectionHeading as="h3" className="mb-3">
          Flujo esperado 30 días por moneda
        </SectionHeading>
        <div className="relative">
          <div ref={scrollRef} className="overflow-x-auto [scrollbar-width:thin]">
            <Table className="min-w-[480px]">
          <TableHeader>
            <DetailTableRow hoverable={false}>
              <DetailTableHead className="whitespace-nowrap">Moneda</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Por cobrar</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Por pagar</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Neto</DetailTableHead>
            </DetailTableRow>
          </TableHeader>
          <TableBody>
            {renglones.map((r) => {
              const neto = r.cobrar - r.pagar;
              return (
                <DetailTableRow key={r.moneda}>
                  <TableCell className="font-medium whitespace-nowrap">{r.moneda}</TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-success">
                    {formatCurrency(r.cobrar, r.moneda)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right tabular-nums text-warning">
                    {formatCurrency(r.pagar, r.moneda)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "whitespace-nowrap text-right tabular-nums font-medium",
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
          </div>
          <HorizontalScrollFades overflowing={overflowing} atStart={atStart} atEnd={atEnd} />
        </div>
      </CardContent>
    </Card>
  );
}
