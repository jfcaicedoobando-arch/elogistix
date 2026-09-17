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
import { Hint } from "@/components/shared/Hint";
import { ToneBadge } from "@/components/shared/ToneBadge";
import { Button } from "@/components/ui/button";
import { CalendarClock, ShieldCheck, Wallet } from "lucide-react";
import { puedeEjecutarPago } from "@/features/tesoreria/domain/pagosProgramados";

interface Props {
  semanas: SemanaPagosProgramados[];
  sinFecha: FacturaProgramable[];
  columns: ColumnDef<FacturaProgramable, unknown>[];
  onEjecutarPago: (f: FacturaProgramable) => void;
  /** MNY-P2.5: navegar a la factura de Compras (aprobar o programar fecha). */
  onAbrirFactura: (f: FacturaProgramable) => void;
}

interface AccionesProps {
  r: FacturaProgramable;
  onEjecutarPago: (f: FacturaProgramable) => void;
  onAbrirFactura: (f: FacturaProgramable) => void;
}

/**
 * MNY-P2.5: la tarjeta móvil aplica exactamente la misma regla que la tabla de
 * escritorio: una factura sin aprobar (o rechazada) no ofrece "Ejecutar pago"
 * porque el trigger `pagos_proveedor_requiere_aprobacion` lo rechaza, y sin
 * fecha programada la RPC responde LC_PAGO_SIN_PROGRAMACION.
 */
function AccionesFactura({ r, onEjecutarPago, onAbrirFactura }: AccionesProps) {
  if (!puedeEjecutarPago(r)) {
    const rechazada = (r.estado_aprobacion ?? "").trim().toLowerCase() === "rechazada";
    return (
      <div className="flex flex-wrap items-center gap-2">
        <ToneBadge tone={rechazada ? "destructive" : "warning"} size="sm">
          {rechazada ? "Rechazada" : "Por aprobar"}
        </ToneBadge>
        <Button size="sm" variant="ghost" onClick={() => onAbrirFactura(r)}>
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Revisar aprobación
        </Button>
      </div>
    );
  }
  return r.fecha_programada_pago ? (
    <Button size="sm" variant="outline" onClick={() => onEjecutarPago(r)}>
      <Wallet className="h-3.5 w-3.5 mr-1.5" /> Ejecutar pago
    </Button>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => onAbrirFactura(r)}>
      <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> Programar pago
    </Button>
  );
}

function MobileCardFactura({ r, onEjecutarPago, onAbrirFactura }: AccionesProps) {
  const fecha = r.fecha_programada_pago ?? r.fecha_vencimiento;
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        {/* VIZ-02/CI-02: Hint accesible (sin `title` nativo) para nombres y
            folios largos truncados. */}
        <Hint label={r.proveedor_nombre ?? undefined}>
          <div className="font-semibold text-body truncate">
            {r.proveedor_nombre ?? "—"}
          </div>
        </Hint>
        <Hint label={r.folio_proveedor ?? undefined}>
          <div className="text-body-sm text-muted-foreground truncate font-mono">
            {r.folio_proveedor ?? "—"}
          </div>
        </Hint>
        <div className="flex items-center gap-1.5 text-label text-muted-foreground">
          <span>{fecha ? formatDate(fecha) : "—"}</span>
          {r.fecha_programada_pago && <ToneBadge tone="info" size="sm">Prog.</ToneBadge>}
        </div>
        <AccionesFactura r={r} onEjecutarPago={onEjecutarPago} onAbrirFactura={onAbrirFactura} />
      </div>
      {/* VIZ-02: el ancho fijo w-28 recortaba "MXN 1,160.00" a "MXN 1,1…".
          Ahora el chip crece con el importe (mínimo 7rem, máximo 45% de la
          card) y el monto no envuelve. */}
      <MoneyCell
        label="Saldo"
        value={formatCurrency(r.saldo, r.moneda)}
        highlight
        className="shrink-0 w-auto min-w-28 max-w-[45%]"
        valueClassName="whitespace-nowrap"
      />
    </div>
  );
}

export function PagosProgramadosTablas({ semanas, sinFecha, columns, onEjecutarPago, onAbrirFactura }: Props) {
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
                mobileCard={(r) => <MobileCardFactura r={r} onEjecutarPago={onEjecutarPago} onAbrirFactura={onAbrirFactura} />}
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
              <ResponsiveDataTable columns={columns} data={sinFecha} rowKey={(r) => r.id} density={TABLE_DENSITY.embebida} hoverable={false} mobileCard={(r) => <MobileCardFactura r={r} onEjecutarPago={onEjecutarPago} onAbrirFactura={onAbrirFactura} />} />
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
