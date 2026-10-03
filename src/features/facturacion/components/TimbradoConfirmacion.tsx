import { Checkbox } from "@/components/ui/checkbox";
import { formatCurrency } from "@/lib/formatters";

interface ResumenProps {
  ambiente?: string | null;
  cliente: string;
  rfc?: string | null;
  total: number;
  moneda: string;
}

export function TimbradoResumen({ ambiente, cliente, rfc, total, moneda }: ResumenProps) {
  const nombreAmbiente = ambiente === "sandbox" ? "Sandbox (pruebas)" : ambiente === "live" ? "Producción" : "No disponible";
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-md border p-3 text-body">
      <div><dt className="text-muted-foreground">Ambiente de emisión</dt><dd className="font-medium">{nombreAmbiente}</dd></div>
      <div><dt className="text-muted-foreground">Total</dt><dd className="font-medium tabular-nums">{formatCurrency(total, moneda)}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Cliente y RFC</dt><dd className="font-medium">{cliente} · {rfc ?? "RFC no disponible"}</dd></div>
    </dl>
  );
}

export interface TimbradoEmailProps {
  enviarEmail: boolean;
  setEnviarEmail: (v: boolean) => void;
  emailDestino?: string | null;
}

export function TimbradoEmail({ enviarEmail, setEnviarEmail, emailDestino }: TimbradoEmailProps) {
  return (
    <label className="flex items-center gap-2 text-body cursor-pointer">
      <Checkbox checked={enviarEmail} disabled={!emailDestino} onCheckedChange={(c) => setEnviarEmail(c === true)} />
      <span>{emailDestino ? `Enviar el CFDI a ${emailDestino} tras timbrar` : "Sin destinatario disponible. Puedes enviar el CFDI después de timbrar."}</span>
    </label>
  );
}
