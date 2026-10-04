import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { CardSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/errors";
import { useTraspasoDetalle } from "@/features/tesoreria/hooks/useTraspasoDetalle";
import type { RefPago } from "@/features/tesoreria/domain/pagoDetalle";
import { TraspasoDetalleContent } from "./TraspasoDetalleContent";

export function DetalleTraspasoSheet({ referencia, onOpenChange }: { referencia: RefPago; onOpenChange: (open: boolean) => void }) {
  const { data, isLoading, isError, error, refetch } = useTraspasoDetalle(referencia.id);
  return <Sheet open onOpenChange={onOpenChange}>
    <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
      <SheetHeader><SheetTitle>Detalle del traspaso</SheetTitle>
        <SheetDescription>Origen, destino y movimientos del mismo traspaso entre cuentas propias.</SheetDescription>
      </SheetHeader>
      <div className="mt-4 space-y-5">
        {isLoading && <CardSkeleton lines={5} />}
        {isError && <div role="alert" className="space-y-2 text-body text-destructive">
          <p>{getErrorMessage(error)}</p><Button variant="outline" onClick={() => void refetch()}>Reintentar</Button>
        </div>}
        {data && <TraspasoDetalleContent detalle={data} movimientoId={referencia.movimientoId} />}
      </div>
    </SheetContent>
  </Sheet>;
}
