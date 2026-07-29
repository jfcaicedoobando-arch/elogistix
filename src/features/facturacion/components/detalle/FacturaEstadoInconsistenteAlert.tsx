/**
 * Alerta de estado inconsistente del historial de pagos de una factura.
 * Extraído de `FacturaPagosSection` para bajar su complejidad ciclomática.
 */
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface AlertProps {
  estadoFactura?: string;
}

export function FacturaEstadoInconsistenteAlert({ estadoFactura }: AlertProps) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Estado inconsistente</AlertTitle>
      <AlertDescription>
        La factura aparece como «{estadoFactura}» pero no tiene pagos ni notas de
        crédito aplicadas que lo respalden. Verifica con Cobranza antes de usarla
        en reportes.
      </AlertDescription>
    </Alert>
  );
}
