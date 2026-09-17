/**
 * Piezas del bloque "Movimiento bancario" del detalle del pago.
 *
 * Extraídas de `DetallePagoSheet.parts.tsx` para respetar el límite de 200
 * líneas por archivo (Power of 10). Sin cambios de comportamiento.
 */
import { Link } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  esperaMovimientoBancario,
} from "@/features/tesoreria/domain/pagoDetalle";

/**
 * MNY-P2.2: estado vacío del movimiento bancario. El efectivo no genera
 * movimiento del banco por diseño; avisar "falta conciliar" era falsa alarma.
 */
export function MovimientoAusente({ metodoPago }: { metodoPago: string | null }) {
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

