/**
 * Bloque "Aplicado a" del panel Detalle del pago (Tesorería):
 * tabla de facturas a las que se aplicó el pago y su saldo restante.
 */
import { Link } from "react-router-dom";
import { Table, TableBody, TableHeader, TableCell } from "@/components/ui/table";
import { DetailTableHead, DetailTableRow } from "@/components/shared/DetailTable";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  rutaAplicacion, saldoAplicacion, totalAplicado, type AplicacionPago,
} from "@/features/tesoreria/domain/pagoDetalle";

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
