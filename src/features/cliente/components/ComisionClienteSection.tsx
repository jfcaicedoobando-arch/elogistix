/**
 * v13.386.0 — Marca "cuenta directa / sin comisión" a nivel cliente.
 *
 * Default para todos sus embarques; cada embarque puede sobreescribirlo.
 */
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface Value {
  sin_comision: boolean;
}

interface Props<T extends Value> {
  form: T;
  setForm: (fn: (prev: T) => T) => void;
}

export function ComisionClienteSection<T extends Value>({ form, setForm }: Props<T>) {
  return (
    <FormDialogSection
      title="Comisión de venta"
      description="Define si los embarques de este cliente generan comisión para la vendedora."
    >
      <div className="md:col-span-2 flex items-start justify-between gap-4 rounded-md border border-border p-3">
        <div className="space-y-1">
          <Label htmlFor="cliente-sin-comision" className="text-xs">
            Cuenta directa (sin comisión)
          </Label>
          <p className="text-xs text-muted-foreground">
            Al activarlo, los embarques de este cliente no devengan comisión salvo que el
            embarque indique lo contrario.
          </p>
        </div>
        <Switch
          id="cliente-sin-comision"
          checked={form.sin_comision}
          onCheckedChange={(v) => setForm((p) => ({ ...p, sin_comision: v }))}
        />
      </div>
    </FormDialogSection>
  );
}
