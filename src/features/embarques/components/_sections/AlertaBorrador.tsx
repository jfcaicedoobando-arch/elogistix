/**
 * Aviso de embarque en Borrador. v13.492.0 — refuerza el mensaje cuando el ETD
 * ya venció: el embarque sigue sin confirmar aunque las fechas indiquen que
 * debió zarpar.
 */
import { FileEdit } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Props {
  etd: string | null;
}

/** ETD vencido = fecha de salida anterior a hoy (comparación en UTC). */
export function etdVencido(etd: string | null): boolean {
  if (!etd) return false;
  const now = new Date();
  const hoy = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const fecha = new Date(`${etd.slice(0, 10)}T00:00:00Z`).getTime();
  return !Number.isNaN(fecha) && fecha < hoy;
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
