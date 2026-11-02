import { Button } from "@/components/ui/button";

interface Props {
  email: string | null | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  disabled: boolean;
  errorMessage?: string;
  requiereRevision?: boolean;
}

export function DestinatarioRecordatorioAviso({ email, isLoading, isError, onRetry, disabled, errorMessage, requiereRevision }: Props) {
  if (isLoading) return <p role="status" className="text-body-sm text-muted-foreground">Consultando destinatario…</p>;
  if (isError) return (
    <div role="alert" className="space-y-2 text-body-sm">
      <p>{errorMessage ?? 'No pudimos consultar el destinatario. Reintenta antes de enviar el recordatorio.'}</p>
      <Button variant="outline" onClick={onRetry} disabled={disabled}>{requiereRevision ? 'Revisar destinatario' : 'Reintentar consulta'}</Button>
    </div>
  );
  if (!email) return (
    <div role="status" className="space-y-2 text-body-sm">
      <p>No hay un correo disponible para este cliente. Pide que se complete en Contactos del cliente y vuelve a consultarlo.</p>
      <Button variant="outline" onClick={onRetry} disabled={disabled}>Volver a consultar</Button>
    </div>
  );
  return (
    <div className="space-y-1 text-body-sm">
      <p className="break-all"><span className="font-medium">Destinatario:</span> {email}</p>
      <p className="text-muted-foreground">Se enviará a este correo guardado en Contactos del cliente. Si no corresponde, cancela y pide que revisen sus contactos.</p>
    </div>
  );
}
