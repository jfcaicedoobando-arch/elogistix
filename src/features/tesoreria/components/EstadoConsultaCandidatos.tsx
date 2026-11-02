import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/skeletons";

export interface EstadoConsultaCandidatosProps {
  hasData: boolean;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  onRetry: () => void;
}

export function EstadoConsultaCandidatos({
  hasData, isLoading, isFetching, isError, onRetry,
}: EstadoConsultaCandidatosProps) {
  if (isLoading || (!hasData && !isError)) return <CardSkeleton lines={2} showHeader={false} />;

  if (isError) {
    return (
      <Alert variant={hasData ? "warning" : "destructive"}>
        <AlertDescription className="space-y-2">
          <p>{hasData
            ? "No pudimos actualizar los pagos candidatos. Se muestran los últimos datos cargados. Reintenta antes de registrar otro pago."
            : "No pudimos consultar los pagos para este movimiento. Reintenta la búsqueda antes de registrar otro pago."}</p>
          <Button variant="outline" size="sm" onClick={onRetry} loading={isFetching}>
            Reintentar búsqueda
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return isFetching ? <p role="status" className="text-body-sm text-muted-foreground">Actualizando pagos candidatos…</p> : null;
}
