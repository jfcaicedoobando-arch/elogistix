import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { esSalidaPendienteDeConfirmar } from "@/features/embarques/domain/salidaPendiente";

export function SalidaPendienteAlert({ estado, etd }: { estado: string; etd?: string | null }) {
  if (!esSalidaPendienteDeConfirmar(estado, etd)) return null;
  return (
    <Alert className="mb-4 border-warning/40 bg-warning/10">
      <AlertTriangle className="h-4 w-4" aria-hidden />
      <AlertTitle>Salida pendiente de confirmar</AlertTitle>
      <AlertDescription>
        La ETD venció. Verifica la salida con el transportista antes de avanzar a En Tránsito.
        La fecha estimada no cambia el estado ni genera un aviso de salida al cliente.
      </AlertDescription>
    </Alert>
  );
}
