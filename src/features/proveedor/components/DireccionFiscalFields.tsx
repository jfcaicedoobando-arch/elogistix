/**
 * Bloque compartido de dirección fiscal para proveedor (CP + Régimen SAT + Dirección + Ciudad + Estado).
 * Consumido por `NuevoProveedorStep1FiscalFields` (alta) y `EditarProveedorGastoFiscalFields` (edición).
 * DRY Lote 8b — elimina ~55 líneas duplicadas entre ambos formularios.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { REGIMENES_FISCALES_SAT } from "@/constants/regimenFiscalSAT";

interface FormShape {
  cp?: string | null;
  regimen_fiscal?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  estado?: string | null;
}

interface Props<F extends FormShape> {
  form: F;
  setField: <K extends keyof F>(key: K, value: F[K]) => void;
  /** Muestra asterisco de requerido en el label del régimen. */
  regimenRequired?: boolean;
}

export function DireccionFiscalFields<F extends FormShape>({ form, setField, regimenRequired }: Props<F>) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Código Postal</Label>
          <Input
            value={form.cp ?? ""}
            maxLength={5}
            inputMode="numeric"
            placeholder="64000"
            onChange={(e) => setField("cp" as keyof F, e.target.value.replace(/\D/g, "") as F[keyof F])}
          />
        </div>
        <div className="space-y-2">
          <Label>Régimen Fiscal{regimenRequired ? " *" : ""}</Label>
          <Select
            value={form.regimen_fiscal ?? ""}
            onValueChange={(v) => setField("regimen_fiscal" as keyof F, v as F[keyof F])}
          >
            <SelectTrigger><SelectValue placeholder="Selecciona régimen" /></SelectTrigger>
            <SelectContent>
              {REGIMENES_FISCALES_SAT.map((r) => (
                <SelectItem key={r.clave} value={r.clave}>
                  {r.clave} — {r.descripcion}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Dirección</Label>
        <Input
          value={form.direccion ?? ""}
          onChange={(e) => setField("direccion" as keyof F, e.target.value as F[keyof F])}
          placeholder="Calle, número, colonia"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Ciudad / Municipio</Label>
          <Input
            value={form.ciudad ?? ""}
            onChange={(e) => setField("ciudad" as keyof F, e.target.value as F[keyof F])}
          />
        </div>
        <div className="space-y-2">
          <Label>Estado</Label>
          <Input
            value={form.estado ?? ""}
            onChange={(e) => setField("estado" as keyof F, e.target.value as F[keyof F])}
          />
        </div>
      </div>
    </>
  );
}
