/**
 * Bandeja de tablas por semana + "sin fecha" de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TableRow, TableCell } from "@/components/ui/table";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { FacturaProgramable, SemanaPagosProgramados } from "@/features/tesoreria/domain/pagosProgramados";
import { SectionHeading } from "@/components/shared/SectionHeading";
import EmptyState from "@/components/empty/EmptyState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";

interface Props {
  semanas: SemanaPagosProgramados[];
  sinFecha: FacturaProgramable[];
  columns: ColumnDef<FacturaProgramable, unknown>[];
}

export function PagosProgramadosTablas({ semanas, sinFecha, columns }: Props) {
  if (semanas.length === 0 && sinFecha.length === 0) {
    return (
      <Card>
        <CardContent className="p-0">
          <EmptyState
            icon={Inbox}
            title="Sin pagos para mostrar"
            description="Las facturas de proveedor con fecha de vencimiento o programada aparecerán aquí."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {semanas.map((s) => (
        <section key={s.semanaKey}>
          <SectionHeading variant="overline" className="mb-3 px-1">
            Semana del {formatDate(s.semanaInicio)} al {formatDate(s.semanaFin)}
          </SectionHeading>
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={s.facturas}
                rowKey={(r) => r.id}
                density={TABLE_DENSITY.embebida}
                hoverable={false}
                footer={() => (
                  // VT-30: el footer se renderiza dentro de <tfoot>; un <div>
                  // suelto era HTML inválido y el fondo solo cubría ~40% del
                  // ancho. Fila con colspan = todas las columnas → fondo 100%.
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={columns.length}>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 py-2">
                        <span className="text-xs font-bold uppercase text-muted-foreground">Totales:</span>
                        {Object.entries(s.totalesPorMoneda).map(([moneda, total]) => (
                          <span key={moneda} className="text-sm font-semibold tabular-nums">
                            {formatCurrency(total, moneda)}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              />
            </CardContent>
          </Card>
        </section>
      ))}

      {sinFecha.length > 0 && (
        <section>
          <SectionHeading variant="overline" className="mb-3 px-1">
            Sin fecha de pago ({sinFecha.length})
          </SectionHeading>
          <Card>
            <CardContent className="p-0">
              <DataTable columns={columns} data={sinFecha} rowKey={(r) => r.id} density={TABLE_DENSITY.embebida} hoverable={false} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
