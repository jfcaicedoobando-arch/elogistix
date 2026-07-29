/**
 * Bandeja de tablas por semana + "sin fecha" de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DataTable, type ColumnDef } from "@/components/shared/DataTable";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { FacturaProgramable, SemanaPagosProgramados } from "@/features/tesoreria/domain/pagosProgramados";

interface Props {
  semanas: SemanaPagosProgramados[];
  sinFecha: FacturaProgramable[];
  columns: ColumnDef<FacturaProgramable, unknown>[];
}

export function PagosProgramadosTablas({ semanas, sinFecha, columns }: Props) {
  if (semanas.length === 0 && sinFecha.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 flex flex-col items-center justify-center text-center">
          <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">Sin pagos para mostrar</h3>
          <p className="text-sm text-muted-foreground">
            Las facturas de proveedor con fecha de vencimiento o programada aparecerán aquí.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {semanas.map((s) => (
        <section key={s.semanaKey}>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            Semana del {formatDate(s.semanaInicio)} al {formatDate(s.semanaFin)}
          </h2>
          <Card>
            <CardContent className="p-0">
              <DataTable
                columns={columns}
                data={s.facturas}
                rowKey={(r) => r.id}
                density="compact"
                hoverable={false}
                footer={() => (
                  <div className="flex flex-wrap gap-x-6 gap-y-1 py-3 px-4 bg-muted/30">
                    <span className="text-xs font-bold uppercase text-muted-foreground">Totales:</span>
                    {Object.entries(s.totalesPorMoneda).map(([moneda, total]) => (
                      <span key={moneda} className="text-sm font-semibold tabular-nums">
                        {formatCurrency(total, moneda)}
                      </span>
                    ))}
                  </div>
                )}
              />
            </CardContent>
          </Card>
        </section>
      ))}

      {sinFecha.length > 0 && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 px-1">
            Sin fecha de pago ({sinFecha.length})
          </h2>
          <Card>
            <CardContent className="p-0">
              <DataTable columns={columns} data={sinFecha} rowKey={(r) => r.id} density="compact" hoverable={false} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
