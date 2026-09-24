/**
 * P2-8: aviso discreto cuando el resumen de alertas no cargó y no hay filtro
 * `?alerta=` activo. La lista sigue visible; nunca se afirma "0 alertas".
 */
import { TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function EmbarquesAlertasError({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert variant="warning" data-testid="alertas-no-disponibles">
      <TriangleAlert className="size-4" />
      <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
        <span>No pudimos cargar las alertas de embarques.</span>
        <Button size="sm" variant="outline" onClick={onRetry}>Reintentar</Button>
      </AlertDescription>
    </Alert>
  );
}
