/**
 * Campos reutilizables de los formularios de Pricing (texto, número, fecha,
 * lista y Sí/No). Radix Select no admite valor vacío: usamos "sin" como nulo.
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const SIN = "sin";

interface Base { id: string; label: string; disabled?: boolean }

export function CampoTexto({ id, label, value, onChange, disabled, type = "text", required }: Base & {
  value: string | number | null | undefined; onChange: (v: string) => void; type?: "text" | "number" | "date"; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Input id={id} type={type} value={value ?? ""} disabled={disabled} maxLength={type === "text" ? 300 : undefined}
        onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function CampoLista({ id, label, value, onChange, opciones, disabled, required }: Base & {
  value: string | null | undefined; onChange: (v: string | null) => void;
  opciones: ReadonlyArray<string | { value: string; label: string }>; required?: boolean;
}) {
  const items = opciones.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}{required ? " *" : ""}</Label>
      <Select value={value ?? SIN} disabled={disabled} onValueChange={(v) => onChange(v === SIN ? null : v)}>
        <SelectTrigger id={id}><SelectValue placeholder="Selecciona" /></SelectTrigger>
        <SelectContent>
          <SelectItem value={SIN}>—</SelectItem>
          {items.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export function CampoSiNo({ id, label, value, onChange, disabled }: Base & {
  value: boolean | null | undefined; onChange: (v: boolean | null) => void;
}) {
  const actual = value == null ? null : value ? "si" : "no";
  return (
    <CampoLista id={id} label={label} disabled={disabled} value={actual}
      opciones={[{ value: "si", label: "Sí" }, { value: "no", label: "No" }]}
      onChange={(v) => onChange(v == null ? null : v === "si")} />
  );
}
