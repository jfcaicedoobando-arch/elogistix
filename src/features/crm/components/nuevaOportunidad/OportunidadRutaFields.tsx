/**
 * Campos de ruta de la oportunidad (modo, origen, destino).
 *
 * Extraído de `OportunidadFormFields.tsx` para respetar el límite de 200
 * líneas (Power of 10).
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OportunidadFormState } from "@/features/crm/hooks";

interface Props {
  form: OportunidadFormState;
  set: <K extends keyof OportunidadFormState>(k: K, v: OportunidadFormState[K]) => void;
}

export default function OportunidadRutaFields({ form, set }: Props) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor="op-modo">Modo</Label>
        <Input id="op-modo" value={form.modo} onChange={(e) => set("modo", e.target.value)} placeholder="Marítimo / Aéreo…" />
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-origen">Origen</Label>
        <Input id="op-origen" value={form.origen} onChange={(e) => set("origen", e.target.value)} />
      </div>
      <div className="space-y-1">
        <Label htmlFor="op-destino">Destino</Label>
        <Input id="op-destino" value={form.destino} onChange={(e) => set("destino", e.target.value)} />
      </div>
    </>
  );
}
