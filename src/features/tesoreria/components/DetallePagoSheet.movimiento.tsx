/**
 * Piezas del bloque "Movimiento bancario" del detalle del pago.
 *
 * Extraídas de `DetallePagoSheet.parts.tsx` para respetar el límite de 200
 * líneas por archivo (Power of 10). Los vínculos históricos de ajustes se conservan como evidencia por revisar.
 */
import { Link } from "react-router";
import { TriangleAlert } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  esperaMovimientoBancario, type MovimientoConciliado,
} from "@/features/tesoreria/domain/pagoDetalle";

/**
 * MNY-P2.2: estado vacío del movimiento bancario. El efectivo no genera
 * movimiento del banco por diseño; avisar "falta conciliar" era falsa alarma.
 */
export function MovimientoAusente({ metodoPago, esAjuste = false }: { metodoPago: string | null; esAjuste?: boolean }) {
  if (esAjuste) {
    return (
      <p className="rounded-md border p-3 text-body-sm text-muted-foreground">
        Ajuste no monetario: no genera movimiento en la cuenta bancaria ni requiere conciliación.
      </p>
    );
  }
  if (!esperaMovimientoBancario(metodoPago)) {
    return (
      <p className="rounded-md border p-3 text-body-sm text-muted-foreground">
        Pago en efectivo: no genera movimiento en la cuenta bancaria, así que no
        requiere conciliación.
      </p>
    );
  }
  return (
    <Alert variant="warning">
      <TriangleAlert className="h-4 w-4" />
      <AlertDescription className="space-y-1">
        <p>Este pago todavía no está conciliado con un movimiento del banco.</p>
        <Link to="/tesoreria/conciliacion" className="text-body-sm font-medium text-primary hover:underline">
          Ir a Conciliación bancaria
        </Link>
      </AlertDescription>
    </Alert>
  );
}


/** Evidencia heredada: nunca presentar el ajuste como dinero conciliado. */
export function MovimientoAjusteHistorico({ movimiento, cuentaId, moneda }: {
  movimiento: MovimientoConciliado; cuentaId: string | null; moneda: string;
}) {
  return (
    <section className="space-y-2">
      <SectionHeading as="h3" variant="subsection">Movimiento bancario</SectionHeading>
      <Alert variant="warning">
        <TriangleAlert className="size-4" />
        <AlertDescription className="space-y-2">
          <p className="font-medium">Vínculo bancario por revisar</p>
          <p>Conciliación del ajuste: No aplica. Se conserva el vínculo histórico como evidencia; no acredita un pago.</p>
          <p>{movimiento.concepto ?? "Movimiento del banco"}</p>
          <p>{formatDate(movimiento.fecha)} · {movimiento.cuenta_alias ?? "Cuenta"}</p>
          <p>Cargo registrado: {formatCurrency(movimiento.cargo, moneda)} · Abono registrado: {formatCurrency(movimiento.abono, moneda)}</p>
          {movimiento.referencia ? <p>Ref. {movimiento.referencia}</p> : null}
          <p>Estado histórico registrado: {movimiento.estado_conciliacion ?? "Sin dato"}</p>
          {movimiento.conciliado_at ? <p>Marca histórica de conciliación: {formatDate(movimiento.conciliado_at)}</p> : null}
          {cuentaId ? (
            <Link to={`/tesoreria/estado-cuenta?cuenta=${cuentaId}`} className="text-body-sm font-medium text-primary hover:underline">
              Revisar vínculo en el estado de cuenta
            </Link>
          ) : null}
        </AlertDescription>
      </Alert>
    </section>
  );
}
