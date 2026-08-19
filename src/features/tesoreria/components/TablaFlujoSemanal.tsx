/**
 * Tabla expandible: una fila por semana ISO con totales + detalle al click.
 * Nota: usa markup de detalle (no `DataTable`) porque cada fila expande un
 * bloque de detalle con `colSpan` — layout no soportado por `DataTable`.
 * Homologado con `DetailTable*` (encabezado, hover, zebra) y `whitespace-nowrap`
 * en todas las columnas para que "Flujo neto" y "Saldo proyectado" nunca
 * se corten al angostar el viewport (scrollea el contenedor, no las celdas).
 */
import { Fragment, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableHeader, TableBody, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency } from "@/lib/formatters/numbers";
import { Card, CardContent } from "@/components/ui/card";
import type { SemanaFlujo } from "@/features/tesoreria/services";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { cn } from "@/lib/utils";

interface Props { semanas: SemanaFlujo[] }

export default function TablaFlujoSemanal({ semanas }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
        <Table className="min-w-[720px]">
          <TableHeader>
            <DetailTableRow hoverable={false}>
              <DetailTableHead className="w-8 whitespace-nowrap"></DetailTableHead>
              <DetailTableHead className="whitespace-nowrap">Semana</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap">Periodo</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Entradas</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Salidas</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Flujo neto</DetailTableHead>
              <DetailTableHead className="whitespace-nowrap text-right">Saldo proyectado</DetailTableHead>
            </DetailTableRow>
          </TableHeader>
          <TableBody>
            {semanas.map((s, i) => {
              const isOpen = expanded.has(s.semana_iso);
              const saldoNeg = s.saldo_proyectado_mxn < 0;
              const striped = i % 2 === 1;
              return (
                <Fragment key={s.semana_iso}>
                  <DetailTableRow
                    className={cn("cursor-pointer", striped && "bg-muted/20")}
                    onClick={() => toggle(s.semana_iso)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-label={`${isOpen ? "Colapsar" : "Expandir"} detalle de la semana ${s.semana_iso}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggle(s.semana_iso);
                      }
                    }}
                  >
                    <TableCell className="whitespace-nowrap">
                      {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </TableCell>
                    <TableCell className="whitespace-nowrap font-medium">{s.semana_iso}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{s.inicio} → {s.fin}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-success">{formatCurrency(s.entradas_mxn, "MXN")}</TableCell>
                    <TableCell className="whitespace-nowrap text-right tabular-nums text-destructive">{formatCurrency(s.salidas_mxn, "MXN")}</TableCell>
                    <TableCell className={cn("whitespace-nowrap text-right tabular-nums font-medium", s.flujo_neto_mxn >= 0 ? "text-success" : "text-destructive")}>
                      {formatCurrency(s.flujo_neto_mxn, "MXN")}
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap text-right tabular-nums font-semibold", saldoNeg && "text-destructive")}>
                      {formatCurrency(s.saldo_proyectado_mxn, "MXN")}
                    </TableCell>
                  </DetailTableRow>
                  {isOpen && (
                    <DetailTableRow hoverable={false} className={striped ? "bg-muted/20" : undefined}>
                      <TableCell></TableCell>
                      <TableCell colSpan={6} className="text-body-sm">
                        <DetalleListas s={s} />
                      </TableCell>
                    </DetailTableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function DetalleListas({ s }: { s: SemanaFlujo }) {
  return (
    <div className="grid md:grid-cols-2 gap-4 py-2">
      <div>
        <SectionHeading as="h3" variant="subsection" count={s.detalle_entradas.length} className="mb-1 text-success">
          Entradas
        </SectionHeading>
        {s.detalle_entradas.length === 0 ? (
          <EmptyStateInline message="Sin movimientos." density="compact" className="py-2" />
        ) : (
          <ul className="space-y-0.5">
            {s.detalle_entradas.map((d) => (
              <li key={d.id} className="flex justify-between border-b last:border-0 py-0.5">
                <span className="truncate flex-1 mr-2">{d.concepto}</span>
                <span className="tabular-nums">{formatCurrency(d.monto_mxn, "MXN")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <SectionHeading as="h3" variant="subsection" count={s.detalle_salidas.length} className="mb-1 text-destructive">
          Salidas
        </SectionHeading>
        {s.detalle_salidas.length === 0 ? (
          <EmptyStateInline message="Sin movimientos." density="compact" className="py-2" />
        ) : (
          <ul className="space-y-0.5">
            {s.detalle_salidas.map((d) => (
              <li key={d.id} className="flex justify-between border-b last:border-0 py-0.5">
                <span className="truncate flex-1 mr-2">{d.concepto}</span>
                <span className="tabular-nums">{formatCurrency(d.monto_mxn, "MXN")}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
