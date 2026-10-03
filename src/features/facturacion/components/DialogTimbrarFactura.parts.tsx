import { Check, X } from "lucide-react";
/**
 * Sub-vistas del modal de timbrado. Extraídas para respetar la regla
 * Power of 10 (≤200 líneas por archivo productivo).
 */
import { Label } from "@/components/ui/label";
import { TimbradoEmail, type TimbradoEmailProps } from "./TimbradoConfirmacion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";

interface CompactoProps extends TimbradoEmailProps {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
}

export function TimbrarCompacto({ usoCfdi, formaPago, metodoPago, ...emailProps }: CompactoProps) {
  return (
    <>
      <div className="text-body text-muted-foreground">
        <span className="font-medium text-foreground">Uso CFDI:</span> {usoCfdi}
        {" · "}
        <span className="font-medium text-foreground">Forma:</span> {formaPago}
        {" · "}
        <span className="font-medium text-foreground">Método:</span> {metodoPago}
      </div>
      <TimbradoEmail {...emailProps} />
    </>
  );
}

interface CompletoProps extends TimbradoEmailProps {
  checks: { ok: boolean; label: string }[];
  usoCfdi: string;
  setUsoCfdi: (v: string) => void;
  formaPago: string;
  setFormaPago: (v: string) => void;
  metodoPago: string;
  setMetodoPago: (v: string) => void;
  puedeTimbrar: boolean;
}

export function TimbrarCompleto(props: CompletoProps) {
  const {
    checks,
    usoCfdi, setUsoCfdi,
    formaPago, setFormaPago,
    metodoPago, setMetodoPago,
    enviarEmail, setEnviarEmail, emailDestino,
    puedeTimbrar,
  } = props;
  return (
    <>
      <ul className="text-body space-y-1">
        {checks.map((c, i) => (
          <li key={i} className={`flex items-center gap-1.5 ${c.ok ? "text-success" : "text-destructive"}`}>
            {c.ok ? <Check className="h-3.5 w-3.5" aria-hidden /> : <X className="h-3.5 w-3.5" aria-hidden />}
            {c.label}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label>Uso CFDI</Label>
          <Select value={usoCfdi} onValueChange={setUsoCfdi}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {USOS_CFDI_SAT.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Forma de pago</Label>
          <Select value={formaPago} onValueChange={setFormaPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {FORMAS_PAGO_SAT.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Método de pago</Label>
          <Select value={metodoPago} onValueChange={setMetodoPago}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {METODOS_PAGO_SAT.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <TimbradoEmail enviarEmail={enviarEmail} setEnviarEmail={setEnviarEmail} emailDestino={emailDestino} />

      {!puedeTimbrar && (
        <Alert variant="destructive">
          <AlertDescription>
            Completa los datos fiscales del cliente antes de timbrar.
            Puedes hacerlo en el detalle del cliente.
          </AlertDescription>
        </Alert>
      )}
    </>
  );
}
