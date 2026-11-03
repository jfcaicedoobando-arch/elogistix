import { AlertTriangle, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyStateInline } from "@/components/empty/EmptyStateInline";

interface Props {
  tieneDatos: boolean;
  ausenciaConfirmada: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
  onQuitar: () => void;
}

/** Un error no confirma que la tarifa haya dejado de estar vigente. */
export function TarifaVinculadaEstadoConsulta({
  tieneDatos, ausenciaConfirmada, isLoading, isFetching, isError, onRetry, onQuitar,
}: Props) {
  if (isError) {
    return (
      <div role="alert" className="flex flex-wrap items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
        <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" aria-hidden />
        <div className="flex-1 min-w-48 text-body">
          <p className="font-medium">No pudimos consultar la tarifa vinculada.</p>
          <p className="text-muted-foreground">
            {tieneDatos
              ? "Mostramos los últimos datos consultados. No pudimos confirmar si siguen vigentes."
              : "Reintenta antes de cambiarla; todavía no podemos confirmar su vigencia."}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onRetry} disabled={isFetching} loading={isFetching}>
          {isFetching ? "Reintentando…" : "Reintentar"}
        </Button>
      </div>
    );
  }
  if (isLoading || isFetching) {
    return (
      <div role="status">
        <EmptyStateInline loading className="py-2" message={tieneDatos
          ? "Actualizando tarifa… Los datos mostrados son los de la última consulta."
          : "Cargando tarifa…"} />
      </div>
    );
  }
  if (!ausenciaConfirmada) return null;
  return (
    <div role="status" className="flex flex-wrap items-start gap-2 rounded-md border border-warning/30 bg-warning/5 p-3">
      <AlertTriangle className="size-4 shrink-0 text-warning mt-0.5" aria-hidden />
      <div className="flex-1 min-w-48 text-body">
        <p className="font-medium">La tarifa vinculada no está disponible entre las tarifas vigentes.</p>
        <p className="text-muted-foreground">Quita el vínculo y elige otra tarifa.</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={onQuitar}>
        <Unlink className="size-4 mr-1" /> Quitar
      </Button>
    </div>
  );
}
