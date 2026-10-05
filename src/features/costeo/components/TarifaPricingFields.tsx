/**
 * Campos de la respuesta de pricing dentro del formulario de tarifa:
 * unidad del flete y carta garantía. Sólo se muestran en el alta ligada
 * a una solicitud de pricing.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { TarifaInput } from "@/features/costeo/services/tarifas";

interface Props {
  form: TarifaInput;
  setForm: (f: TarifaInput) => void;
}

const valorCarta = (v?: boolean | null) => (v === true ? "si" : v === false ? "no" : "sin_dato");

export function TarifaPricingFields({ form, setForm }: Props) {
  if (!form.solicitud_pricing_id) return null;
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div>
        <Label htmlFor="tarifa-unidad-flete">Unidad del flete</Label>
        <Input
          id="tarifa-unidad-flete"
          value={form.unidad_flete ?? ""}
          placeholder="Por contenedor, W/M…"
          onChange={(e) => setForm({ ...form, unidad_flete: e.target.value || null })}
        />
      </div>
      <div>
        <Label htmlFor="tarifa-carta">Carta garantía</Label>
        <Select
          value={valorCarta(form.carta_garantia)}
          onValueChange={(v) => setForm({ ...form, carta_garantia: v === "si" ? true : v === "no" ? false : null })}
        >
          <SelectTrigger id="tarifa-carta"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sin_dato">Sin dato</SelectItem>
            <SelectItem value="si">Sí</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
