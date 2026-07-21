import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { FormDialogSection } from "@/components/shared/FormDialogSection";

interface Value {
  dias_credito: number | null;
  limite_credito_mxn: number | null;
}

interface Props<T extends Value> {
  form: T;
  setForm: (fn: (prev: T) => T) => void;
}

/**
 * Sección "Condiciones de crédito" compartida por los diálogos de cliente.
 * Fuente única de verdad para días y límite de crédito (Fase 3-4).
 */
export function CondicionesCreditoSection<T extends Value>({ form, setForm }: Props<T>) {
  return (
    <FormDialogSection
      title="Condiciones de crédito"
      description="Fuente única de verdad. Aplica a proformas y facturas emitidas al cliente."
    >
      <div>
        <Label className="text-xs">Días de crédito</Label>
        <Input
          type="number" inputMode="numeric" min={0} max={365}
          value={form.dias_credito ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setForm((p) => ({ ...p, dias_credito: v === "" ? null : Math.max(0, Number(v)) }));
          }}
          placeholder="Ej. 30" className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Límite de crédito (MXN)</Label>
        <Input
          type="number" inputMode="decimal" min={0} step="0.01"
          value={form.limite_credito_mxn ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            setForm((p) => ({ ...p, limite_credito_mxn: v === "" ? null : Math.max(0, Number(v)) }));
          }}
          placeholder="Vacío = sin límite" className="mt-1"
        />
      </div>
    </FormDialogSection>
  );
}
