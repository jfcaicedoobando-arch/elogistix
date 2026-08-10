/**
 * Aviso de embarque en Borrador. v13.492.0 — refuerza el mensaje cuando el ETD
 * ya venció: el embarque sigue sin confirmar aunque las fechas indiquen que
 * debió zarpar.
 */
import { FileEdit } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { etdVencido } from "@/features/embarques/domain/etdVencido";

interface Props {
  etd: string | null;
}

export function AlertaBorrador({ etd }: Props) {
  const vencido = etdVencido(etd);
  return (
    <Alert variant="warning">
      <FileEdit className="h-4 w-4" />
      <AlertTitle>Embarque en borrador — todavía no está confirmado</AlertTitle>
      <AlertDescription>
        Este embarque fue generado desde la cotización. Complétalo y cambia su estado a
        Confirmado para continuar con la operación.
        {vencido && (
          <>
            {" "}
            <strong>
              Ojo: la fecha de salida (ETD) ya venció y el embarque sigue en borrador.
            </strong>{" "}
            La línea de tiempo no avanza mientras no lo confirmes.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
