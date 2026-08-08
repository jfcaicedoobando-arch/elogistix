/**
 * Panel lateral "Detalle del pago".
 *
 * Responde dos preguntas del contador: ¿a qué movimiento bancario quedó
 * amarrado este pago? y ¿a qué factura(s) se aplicó? Se abre desde
 * Tesorería → Pagos y desde el panel de Conciliación bancaria.
 */
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { usePagoDetalle } from "@/features/tesoreria/hooks/usePagoDetalle";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { getErrorMessage } from "@/lib/errors";
import {
  BloqueAplicaciones,
  BloqueMovimiento,
  BloquePago,
} from "./DetallePagoSheet.parts";

interface Props {
  /** Pago a mostrar; `null` cierra el panel. */
  ref_pago: RefPago | null;
  onOpenChange: (open: boolean) => void;
}

export function DetallePagoSheet({ ref_pago, onOpenChange }: Props) {
  const { data, isLoading, isError, error, refetch } = usePagoDetalle(ref_pago);

  return (
    <Sheet open={!!ref_pago} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Detalle del pago</SheetTitle>
          <SheetDescription>
            Movimiento bancario conciliado y facturas a las que se aplicó.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-5">
          {isLoading ? <CardSkeleton lines={5} /> : null}

          {isError ? (
            <div className="space-y-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p>{getErrorMessage(error)}</p>
              <Button size="sm" variant="outline" onClick={() => void refetch()}>
                Reintentar
              </Button>
            </div>
          ) : null}

          {data ? (
            <>
              <BloquePago pago={data.pago} />
              <BloqueMovimiento
                movimiento={data.movimiento}
                cuentaId={data.movimiento?.cuenta_bancaria_id ?? data.pago.cuenta_bancaria_id}
              />
              <BloqueAplicaciones aplicaciones={data.aplicaciones} />
            </>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}
