/**
 * Sub-vistas del modal de timbrado. Extraídas para respetar la regla
 * Power of 10 (≤200 líneas por archivo productivo).
 */
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";

interface CompactoProps {
  usoCfdi: string;
  formaPago: string;
  metodoPago: string;
  enviarEmail: boolean;
  setEnviarEmail: (v: boolean) => void;
}

export function TimbrarCompacto({ usoCfdi, formaPago, metodoPago, enviarEmail, setEnviarEmail }: CompactoProps) {
  return (
    <>
      <div className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Uso CFDI:</span> {usoCfdi}
        {" · "}
        <span className="font-medium text-foreground">Forma:</span> {formaPago}
        {" · "}
        <span className="font-medium text-foreground">Método:</span> {metodoPago}
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={enviarEmail} onCheckedChange={(c) => setEnviarEmail(c === true)} />
        <span>Enviar el CFDI por email al cliente tras timbrar</span>
      </label>
    </>
  );
}

interface CompletoProps {
  checks: { ok: boolean; label: string }[];
  usoCfdi: string;
  setUsoCfdi: (v: string) => void;
  formaPago: string;
  setFormaPago: (v: string) => void;
  metodoPago: string;
  setMetodoPago: (v: string) => void;
  enviarEmail: boolean;
  setEnviarEmail: (v: boolean) => void;
  puedeTimbrar: boolean;
}

export function TimbrarCompleto(props: CompletoProps) {
  const {
    checks,
    usoCfdi, setUsoCfdi,
    formaPago, setFormaPago,
    metodoPago, setMetodoPago,
    enviarEmail, setEnviarEmail,
    puedeTimbrar,
  } = props;
  return (
    <>
      <ul className="text-sm space-y-1">
        {checks.map((c, i) => (
          <li key={i} className={c.ok ? "text-success" : "text-destructive"}>
            {c.ok ? "✓" : "✗"} {c.label}
          </li>
        ))}
      </ul>

      <div className="grid grid-cols-2 gap-3">
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

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <Checkbox checked={enviarEmail} onCheckedChange={(c) => setEnviarEmail(c === true)} />
        <span>Enviar el CFDI por email al cliente tras timbrar</span>
      </label>

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
