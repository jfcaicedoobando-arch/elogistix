/** Clasificación comercial del cliente (sólo informativa). */
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormDialogSection } from "@/components/shared/FormDialogSection";
import { TIPOS_CLIENTE, normalizarTipoCliente, type TipoCliente } from "../utils/tipoCliente";

interface Value {
  tipo_cliente: TipoCliente;
}

interface Props<T extends Value> {
  form: T;
  setForm: (fn: (prev: T) => T) => void;
  disabled?: boolean;
}

export function TipoClienteSection<T extends Value>({ form, setForm, disabled }: Props<T>) {
  return (
    <FormDialogSection title="Tipo de cliente" description="Clasificación comercial del cliente.">
      <div className="md:col-span-2 space-y-1">
        <Label htmlFor="cliente-tipo">Tipo de cliente</Label>
        <Select
          value={form.tipo_cliente}
          disabled={disabled}
          onValueChange={(v) => setForm((p) => ({ ...p, tipo_cliente: normalizarTipoCliente(v) }))}
        >
          <SelectTrigger id="cliente-tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS_CLIENTE.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {disabled && (
          <p className="text-xs text-muted-foreground">Sólo un administrador o gerente puede cambiarlo.</p>
        )}
      </div>
    </FormDialogSection>
  );
}
