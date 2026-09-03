/**
 * Selects fiscales (régimen, uso CFDI, forma y método de pago) del alta de cliente.
 * Extraído de `NuevoClienteFormPieces.tsx` para respetar el límite de 200 líneas.
 */
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";
import { USOS_CFDI_SAT, FORMAS_PAGO_SAT, METODOS_PAGO_SAT } from "@/constants/catalogosSAT";
import { PrellenadoBadge } from "./NuevoClienteFormPieces";

/**
 * Forma mínima que necesita este bloque. Se define estructuralmente (y no con
 * `ClienteForm`) para que también lo pueda reutilizar la conversión
 * Prospecto → Cliente, que usa `ClienteFormData`.
 */
export interface ClienteFiscalCampos {
  regimen_fiscal: string;
  uso_cfdi_default: string;
  forma_pago_default: string;
  metodo_pago_default: string;
}

interface SelectsProps {
  form: ClienteFiscalCampos;
  onChange: (field: keyof ClienteFiscalCampos, value: string) => void;
  prefilledRegimen?: boolean;
}

/** Bloque con Régimen Fiscal + Uso CFDI default (campos SAT). */
export function ClienteFiscalSelects({ form, onChange, prefilledRegimen }: SelectsProps) {
  return (
    <>
      <div>
        <Label size="sm" className="flex items-center">
          Régimen Fiscal SAT<span className="text-destructive ml-0.5">*</span>
          {prefilledRegimen && form.regimen_fiscal && <PrellenadoBadge />}
        </Label>
        <Select value={form.regimen_fiscal || undefined} onValueChange={(v) => onChange("regimen_fiscal", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
          <SelectContent>
            {REGIMENES_FISCALES_SAT.map((r) => (
              <SelectItem key={r.clave} value={r.clave}>{r.clave} — {r.descripcion}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Uso CFDI por defecto</Label>
        <Select value={form.uso_cfdi_default || undefined} onValueChange={(v) => onChange("uso_cfdi_default", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona uso CFDI" /></SelectTrigger>
          <SelectContent>
            {USOS_CFDI_SAT.map((u) => (
              <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* O4.6: pre-flight fiscal — evita que el timbrado se detenga después. */}
      <div>
        <Label size="sm" className="flex items-center">
          Forma de pago por defecto<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Select value={form.forma_pago_default || undefined} onValueChange={(v) => onChange("forma_pago_default", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona forma de pago" /></SelectTrigger>
          <SelectContent>
            {FORMAS_PAGO_SAT.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label size="sm" className="flex items-center">
          Método de pago por defecto<span className="text-destructive ml-0.5">*</span>
        </Label>
        <Select value={form.metodo_pago_default || undefined} onValueChange={(v) => onChange("metodo_pago_default", v)}>
          <SelectTrigger className="mt-1"><SelectValue placeholder="Selecciona método de pago" /></SelectTrigger>
          <SelectContent>
            {METODOS_PAGO_SAT.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </>

  );
}

