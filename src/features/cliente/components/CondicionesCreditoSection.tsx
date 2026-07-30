import { useState } from "react";
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

/** Buffer local: mientras se teclea se conserva el string crudo y sólo se
 *  confirma al salir del campo (R-15). Así "30" no se convierte en "3" ni el
 *  cursor salta cuando el estado global se re-renderiza. */
function useBufferNumerico(
  valor: number | null,
  commit: (n: number | null) => void,
  max?: number,
) {
  const [raw, setRaw] = useState<string | null>(null);
  return {
    value: raw ?? (valor ?? ""),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setRaw(e.target.value),
    onBlur: () => {
      if (raw !== null) {
        const limpio = raw.trim();
        if (limpio === "") commit(null);
        else {
          const n = Number(limpio);
          commit(Number.isFinite(n) ? Math.min(max ?? Infinity, Math.max(0, n)) : null);
        }
      }
      setRaw(null);
    },
  };
}

/**
 * Sección "Condiciones de crédito" compartida por los diálogos de cliente.
 * Fuente única de verdad para días y límite de crédito (Fase 3-4).
 */
export function CondicionesCreditoSection<T extends Value>({ form, setForm }: Props<T>) {
  const dias = useBufferNumerico(
    form.dias_credito,
    (n) => setForm((p) => ({ ...p, dias_credito: n })),
    365,
  );
  const limite = useBufferNumerico(
    form.limite_credito_mxn,
    (n) => setForm((p) => ({ ...p, limite_credito_mxn: n })),
  );

  return (
    <FormDialogSection
      title="Condiciones de crédito"
      description="Fuente única de verdad. Aplica a proformas y facturas emitidas al cliente."
    >
      <div>
        <Label className="text-xs">Días de crédito</Label>
        <Input
          type="number" inputMode="numeric" min={0} max={365}
          value={dias.value}
          onChange={dias.onChange}
          onBlur={dias.onBlur}
          placeholder="Ej. 30" className="mt-1"
        />
      </div>
      <div>
        <Label className="text-xs">Límite de crédito (MXN)</Label>
        <Input
          type="number" inputMode="decimal" min={0} step="0.01"
          value={limite.value}
          onChange={limite.onChange}
          onBlur={limite.onBlur}
          placeholder="Vacío = sin límite" className="mt-1"
        />
      </div>
    </FormDialogSection>
  );
}
