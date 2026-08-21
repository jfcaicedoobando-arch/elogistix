/**
 * Bandeja de tablas por semana + "sin fecha" de pagos programados.
 * Extraído de `TesoreriaPagosProgramados` para bajar su tamaño/complejidad.
 */
import { Inbox } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TableCell, TableRow } from "@/components/ui/table";
import { type ColumnDef } from "@/components/shared/DataTable";
import { ResponsiveDataTable } from "@/components/shared/dataTable/ResponsiveDataTable";
import { formatDate, formatCurrency } from "@/lib/formatters";
import type { FacturaProgramable, SemanaPagosProgramados } from "@/features/tesoreria/domain/pagosProgramados";
import { SectionHeading } from "@/components/shared/SectionHeading";
import EmptyState from "@/components/empty/EmptyState";
import { TABLE_DENSITY } from "@/components/shared/dataTable/tableTokens";
import { MoneyCell } from "@/components/shared/MoneyCell";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";

interface Props {
  semanas: SemanaPagosProgramados[];
  sinFecha: FacturaProgramable[];
  columns: ColumnDef<FacturaProgramable, unknown>[];
  onEjecutarPago: (f: FacturaProgramable) => void;
}

function MobileCardFactura({ r, onEjecutarPago }: { r: FacturaProgramable; onEjecutarPago: (f: FacturaProgramable) => void }) {
  const fecha = r.fecha_programada_pago ?? r.fecha_vencimiento;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-semibold text-body truncate">{r.proveedor_nombre ?? "—"}</div>
        <div className="text-body-sm text-muted-foreground truncate font-mono">{r.folio_proveedor ?? "—"}</div>
        <div className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span>{fecha ? formatDate(fecha) : "—"}</span>
          {r.fecha_programada_pago && <ToneBadge tone="info" size="sm">Prog.</ToneBadge>}
        </div>
        <Button size="sm" variant="outline" onClick={() => onEjecutarPago(r)}>
          <Wallet className="h-3.5 w-3.5 mr-1.5" /> Ejecutar pago
        </Button>
      </div>
      <MoneyCell label="Saldo" value={formatCurrency(r.saldo, r.moneda)} highlight className="shrink-0 w-28" />
    </div>
  );
}

export function PagosProgramadosTablas({ semanas, sinFecha, columns, onEjecutarPago }: Props) {
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
              <ResponsiveDataTable
                columns={columns}
                data={s.facturas}
                rowKey={(r) => r.id}
                density={TABLE_DENSITY.embebida}
                hoverable={false}
                mobileCard={(r) => <MobileCardFactura r={r} onEjecutarPago={onEjecutarPago} />}
                footer={() => (
                  // VT-30: el footer se renderiza dentro de <TableFooter>; un <div>
                  // suelto era HTML inválido y el fondo solo cubría ~40% del
                  // ancho. Fila con colspan = todas las columnas → fondo 100%.
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={columns.length}>
                      <div className="flex flex-wrap gap-x-6 gap-y-1 py-2">
                        <span className="text-body-sm font-bold uppercase text-muted-foreground">Totales:</span>
                        {Object.entries(s.totalesPorMoneda).map(([moneda, total]) => (
                          <span key={moneda} className="text-body font-semibold tabular-nums">
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
              <ResponsiveDataTable columns={columns} data={sinFecha} rowKey={(r) => r.id} density={TABLE_DENSITY.embebida} hoverable={false} mobileCard={(r) => <MobileCardFactura r={r} onEjecutarPago={onEjecutarPago} />} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
