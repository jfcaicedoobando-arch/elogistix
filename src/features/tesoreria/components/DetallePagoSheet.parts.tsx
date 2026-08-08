/**
 * Bloques del panel "Detalle del pago" (Tesorería).
 *
 * Se separan del Sheet para mantener cada archivo corto y enfocado:
 * datos del pago, movimiento bancario conciliado y facturas aplicadas.
 */
import { Link } from "react-router-dom";
import { Landmark, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableHeader, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  TIPO_PAGO_DETALLE_LABELS, rutaAplicacion, saldoAplicacion, totalAplicado,
  type AplicacionPago, type MovimientoConciliado, type PagoDetalleEncabezado,
} from "@/features/tesoreria/domain/pagoDetalle";

function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-2xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}

export function BloquePago({ pago }: { pago: PagoDetalleEncabezado }) {
  const esCobro = pago.tipo === "cobro";
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{TIPO_PAGO_DETALLE_LABELS[pago.tipo]}</Badge>
        {pago.es_ajuste ? <Badge variant="outline">Ajuste</Badge> : null}
        {pago.estado ? <Badge variant="outline">{pago.estado}</Badge> : null}
      </div>
      <div className="rounded-md border p-3">
        <p className="text-2xs uppercase tracking-wide text-muted-foreground">
          {esCobro ? "Dinero recibido" : "Dinero pagado"}
        </p>
        <p className={`text-xl font-semibold tabular-nums ${esCobro ? "text-success" : "text-destructive"}`}>
          {formatCurrency(pago.monto, pago.moneda)}
        </p>
        {pago.moneda !== "MXN" ? (
          <p className="text-xs text-muted-foreground">
            Equivale a {formatCurrency(pago.monto_mxn, "MXN")} (TC {pago.tipo_cambio.toFixed(4)})
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Dato label="Fecha">{formatDate(pago.fecha)}</Dato>
        <Dato label={esCobro ? "Cliente" : "Proveedor"}>{pago.contraparte ?? "—"}</Dato>
        <Dato label="Método">{pago.metodo_pago ?? "—"}</Dato>
        <Dato label="Referencia">{pago.referencia ?? "—"}</Dato>
        <Dato label="Cuenta bancaria">{pago.cuenta_alias ?? "—"}</Dato>
        {pago.saldo_disponible != null ? (
          <Dato label="Saldo del anticipo">
            {formatCurrency(pago.saldo_disponible, pago.moneda)}
          </Dato>
        ) : (
          <Dato label="Diferencia cambiaria">
            {formatCurrency(pago.diferencia_cambiaria_mxn, "MXN")}
          </Dato>
        )}
      </div>
      {pago.notas ? <Dato label="Notas">{pago.notas}</Dato> : null}
    </section>
  );
}

export function BloqueMovimiento({
  movimiento,
  cuentaId,
  monedaCuentaPago = null,
  cuentaBancariaPagoId = null,
}: {
  movimiento: MovimientoConciliado | null;
  cuentaId: string | null;
  /** Moneda del pago: sólo se usa si el movimiento es de la misma cuenta bancaria. */
  monedaCuentaPago?: string | null;
  cuentaBancariaPagoId?: string | null;
}) {
  if (!movimiento) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Movimiento bancario</h3>
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 text-warning" />
          <div className="space-y-1">
            <p>Este pago todavía no está conciliado con un movimiento del banco.</p>
            <Link to="/tesoreria/conciliacion" className="text-xs font-medium text-primary hover:underline">
              Ir a Conciliación bancaria
            </Link>
          </div>
        </div>
      </section>
    );
  }

  const esCargo = movimiento.cargo > 0;
  const monto = esCargo ? movimiento.cargo : movimiento.abono;
  // El banco guarda el importe en la moneda de la cuenta; sólo la conocemos con
  // certeza cuando el movimiento y el pago comparten cuenta bancaria.
  const mismaCuenta =
    !!movimiento.cuenta_bancaria_id &&
    movimiento.cuenta_bancaria_id === cuentaBancariaPagoId;
  const monedaMovimiento = mismaCuenta && monedaCuentaPago ? monedaCuentaPago : "MXN";
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Movimiento bancario</h3>
        <Badge variant="outline" className="bg-success/10 text-success border-success/20">
          Conciliado
        </Badge>
      </div>
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{movimiento.concepto ?? "Movimiento del banco"}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(movimiento.fecha)} · {movimiento.cuenta_alias ?? "Cuenta"} ·{" "}
              {esCargo ? "Cargo" : "Abono"}
            </p>
            {movimiento.referencia ? (
              <p className="text-xs text-muted-foreground">Ref. {movimiento.referencia}</p>
            ) : null}
          </div>
          <span className={`whitespace-nowrap tabular-nums text-sm font-semibold ${esCargo ? "text-destructive" : "text-success"}`}>
            {esCargo ? "−" : "+"} {formatCurrency(monto, monedaMovimiento)}
          </span>
        </div>
        {movimiento.conciliado_at ? (
          <p className="text-2xs text-muted-foreground">
            Conciliado el {formatDate(movimiento.conciliado_at)}
          </p>
        ) : null}
        {cuentaId ? (
          <Link
            to={`/tesoreria/estado-cuenta?cuenta=${cuentaId}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Landmark className="h-3.5 w-3.5" />
            Ver en el estado de cuenta
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function BloqueAplicaciones({ aplicaciones }: { aplicaciones: AplicacionPago[] }) {
  if (aplicaciones.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">Aplicado a</h3>
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Todavía no se aplica a ninguna factura. Aplícalo desde el detalle de la factura del proveedor.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          Aplicado a {aplicaciones.length === 1 ? "1 factura" : `${aplicaciones.length} facturas`}
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          Total aplicado {formatCurrency(totalAplicado(aplicaciones), aplicaciones[0].moneda)}
        </span>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <DetailTableRow hoverable={false}>
              <DetailTableHead>Factura</DetailTableHead>
              <DetailTableHead className="text-right">Aplicado</DetailTableHead>
              <DetailTableHead className="text-right">Saldo</DetailTableHead>
            </DetailTableRow>
          </TableHeader>
          <TableBody>
            {aplicaciones.map((a) => (
              <DetailTableRow key={`${a.documento_id}-${a.pago_id ?? a.fecha_aplicacion ?? ""}`}>
                <TableCell className="align-top">
                  <Link
                    to={rutaAplicacion(a)}
                    className="text-sm font-medium text-primary hover:underline"
                  >
                    {a.folio ?? "Sin folio"}
                  </Link>
                  {a.embarque_id ? (
                    <Link
                      to={`/embarques/${a.embarque_id}`}
                      className="block text-2xs text-muted-foreground hover:underline"
                    >
                      Ver embarque
                    </Link>
                  ) : null}
                  {a.fecha_aplicacion ? (
                    <p className="text-2xs text-muted-foreground">
                      Aplicado el {formatDate(a.fecha_aplicacion)}
                    </p>
                  ) : null}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums">
                  {formatCurrency(a.monto_aplicado, a.moneda)}
                </TableCell>
                <TableCell className="text-right align-top tabular-nums text-muted-foreground">
                  {formatCurrency(saldoAplicacion(a), a.moneda)}
                </TableCell>
              </DetailTableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
