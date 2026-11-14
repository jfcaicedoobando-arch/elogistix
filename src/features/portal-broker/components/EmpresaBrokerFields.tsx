/** Datos de la empresa nueva que registra el broker. */
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { TRANSPORTES, type EmpresaBroker } from "../domain/altaProspecto";

type Texto = Exclude<keyof EmpresaBroker, "transporte">;
const CAMPOS: { k: Texto; label: string }[] = [
  { k: "nombre", label: "Nombre de la empresa *" },
  { k: "pais", label: "País *" },
  { k: "rfc", label: "RFC" },
  { k: "sector", label: "Sector" },
  { k: "volumen_usd", label: "Volumen estimado (USD)" },
  { k: "rutas", label: "Rutas" },
  { k: "origen", label: "Origen" },
  { k: "destino", label: "Destino" },
  { k: "incoterm", label: "Incoterm" },
  { k: "proveedor_actual", label: "Proveedor logístico actual" },
  { k: "agente_propio", label: "¿Tiene agente aduanal o transportista propio?" },
];

interface Props {
  value: EmpresaBroker;
  onChange: (v: EmpresaBroker) => void;
}

export default function EmpresaBrokerFields({ value, onChange }: Props) {
  const toggle = (t: string, on: boolean) =>
    onChange({ ...value, transporte: on ? [...value.transporte, t] : value.transporte.filter((x) => x !== t) });

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        {CAMPOS.map((f) => (
          <div key={f.k} className="space-y-1.5">
            <Label htmlFor={`emp-${f.k}`}>{f.label}</Label>
            <Input id={`emp-${f.k}`} value={value[f.k]} onChange={(e) => onChange({ ...value, [f.k]: e.target.value })} />
          </div>
        ))}
      </div>
      <fieldset className="space-y-1.5">
        <legend className="text-body-sm font-medium">Tipo de transporte *</legend>
        <div className="flex flex-wrap gap-4">
          {TRANSPORTES.map((t) => (
            <label key={t} className="flex items-center gap-2 text-body-sm">
              <Checkbox checked={value.transporte.includes(t)} onCheckedChange={(c) => toggle(t, c === true)} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-1.5">
        <Label htmlFor="emp-notas">Notas</Label>
        <Textarea id="emp-notas" rows={3} value={value.notas} onChange={(e) => onChange({ ...value, notas: e.target.value })} />
      </div>
    </div>
  );
}
